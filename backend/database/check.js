require("dotenv").config();

const pool = require("../config/db");
const productModel = require("../models/productModel");
const productUnitModel = require("../models/productUnitModel");
const waslModel = require("../models/waslModel");
const waslItemModel = require("../models/waslItemModel");
const customerModel = require("../models/customerModel");
const customerPaymentModel = require("../models/customerPaymentModel");
const customerStatementModel = require("../models/customerStatementModel");
const waslReturnModel = require("../models/waslReturnModel");
const { calculateReturn, getReturnStatus } = require("../utils/returns");
const { fromCents, toCents } = require("../utils/numbers");

let failed = 0;

const report = (name, ok, details = "") => {
    if (!ok) failed++;
    console.log(`${ok ? "PASS" : "FAIL"}  ${name}${details ? "  " + details : ""}`);
};

const runChecks = async () => {
    // 1. Encoding -----------------------------------------------------
    const enc = await pool.query(
        `SELECT
            current_setting('server_encoding') AS server,
            current_setting('client_encoding') AS client`
    );
    report(
        "Database encoding is UTF8",
        enc.rows[0].server === "UTF8" && enc.rows[0].client === "UTF8",
        `(server: ${enc.rows[0].server}, client: ${enc.rows[0].client})`
    );

    // 2. No dinar left in the working tables ------------------------
    const iqd = await pool.query(
        `SELECT table_name, column_name
         FROM information_schema.columns
         WHERE table_schema = 'public'
           AND table_name NOT LIKE 'legacy\\_%'
           AND (column_name ILIKE '%iqd%'
                OR column_name IN ('currency', 'exchange_rate', 'other_total'))`
    );
    report(
        "No dinar / currency / exchange-rate columns in the working tables",
        iqd.rows.length === 0,
        iqd.rows.map((r) => `${r.table_name}.${r.column_name}`).join(", ")
    );

    const tables = await pool.query(
        `SELECT table_name
         FROM information_schema.tables
         WHERE table_schema = 'public'
           AND table_name IN ('customers', 'customer_payments')`
    );
    report("customers and customer_payments tables exist", tables.rows.length === 2);

    // 3. Search normalization and number reading ---------------------
    const norm = await pool.query(
        `SELECT
            normalize_text($1) = normalize_text($2) AS same_word,
            parse_number($3) AS parsed`,
        [
            "\u0643\u062A\u0627\u0628",
            "\u06A9\u062A\u0627\u0628",
            "\u0661\u066C\u0662\u0663\u0664\u066B\u0665",
        ]
    );
    report("Arabic and Kurdish letters match in search", norm.rows[0].same_word === true);
    report("Arabic digits are read as numbers", Number(norm.rows[0].parsed) === 1234.5);

    // 4. A whole credit story, inside a transaction that is rolled back ---
    const kurdishName = "\u0626\u06D5\u062D\u0645\u06D5\u062F \u06A9\u06D5\u0631\u06CC\u0645";
    const client = await pool.connect();

    try {
        await client.query("BEGIN");

        const product = await productModel.createProduct("\u0641\u06D5\u062D\u0645 \u062A\u06CE\u0633\u062A", client);
        const unit = await productUnitModel.createProductUnit(product.product_id, "\u0628\u06C6\u06A9\u0633", 12.5, null, 0, client);
        report("Product unit price is saved in USD", Number(unit.price_usd) === 12.5);

        const created = await customerModel.createCustomer(kurdishName, "07701525316", null, null, client);
        const customerId = created.customer_id;

        const saved = await customerModel.getCustomerById(customerId, client);
        report("Central Kurdish customer name is saved correctly", saved.name === kurdishName);

        // credit wasl: 2 x 12.5 = 25
        const wasl = await waslModel.createWasl(kurdishName, customerId, "credit", 25, 0, 25, client);
        await waslItemModel.createWaslItem(wasl.wasl_id, product.product_id, unit.unit_id, "\u0641\u06D5\u062D\u0645 \u062A\u06CE\u0633\u062A", "\u0628\u06C6\u06A9\u0633", 2, 12.5, 25, client);

        // the story happened in January: sale on the 2nd, installment on the 5th
        await client.query(
            "UPDATE wasls SET created_at = $1 WHERE wasl_id = $2",
            ["2026-01-02T09:00:00+03:00", wasl.wasl_id]
        );

        let balance = await customerModel.getBalance(customerId, client);
        report("A credit wasl raises the debt", Number(balance) === 25, `(debt ${balance})`);

        // a cash wasl must not change the debt
        await waslModel.createWasl(null, null, "cash", 10, 0, 10, client);
        balance = await customerModel.getBalance(customerId, client);
        report("A cash wasl does not change the debt", Number(balance) === 25);

        // installment of 10
        await customerPaymentModel.createPayment(customerId, 10, "2026-01-05", "test", client);
        balance = await customerModel.getBalance(customerId, client);
        report("An installment lowers the debt", Number(balance) === 15, `(debt ${balance})`);

        const full = await customerModel.getCustomerById(customerId, client);
        report(
            "Customer totals: credit 25, paid 10, balance 15",
            Number(full.total_credit) === 25 && Number(full.total_paid) === 10 && Number(full.balance) === 15
        );

        // the database refuses a credit wasl with a discount, or without a customer
        let refused = 0;
        for (const args of [
            ["x", customerId, "credit", 25, 5, 20],
            [null, null, "credit", 25, 0, 25],
        ]) {
            await client.query("SAVEPOINT refuse_test");
            try {
                await waslModel.createWasl(...args, client);
            } catch (error) {
                refused++;
            }
            await client.query("ROLLBACK TO SAVEPOINT refuse_test");
        }
        report("Database refuses credit with a discount / without a customer", refused === 2);

        // statements
        const rows = await customerStatementModel.getStatementRows(customerId, null, null, client);
        const sales = rows.filter((r) => r.kind === "sale");
        const payments = rows.filter((r) => r.kind === "payment");
        report(
            "Complete statement: sale item on 2026-01-02, payment on 2026-01-05",
            sales.length === 1 && payments.length === 1 &&
                sales[0].row_date === "2026-01-02" && payments[0].row_date === "2026-01-05" &&
                Number(sales[0].amount) === 25 && Number(payments[0].amount) === 10 &&
                rows[0].kind === "sale",
            `(${rows.map((r) => r.kind + " " + r.row_date).join(", ")})`
        );

        const all = await customerStatementModel.getPeriodTotals(customerId, null, null, client);
        report("Complete statement totals: credit 25, paid 10", Number(all.total_credit) === 25 && Number(all.total_paid) === 10);

        const opening = async (from) => Number(await customerStatementModel.getOpeningBalance(customerId, from, client));
        report("Opening balance on 2026-01-01 is 0", (await opening("2026-01-01")) === 0);
        report("Opening balance on 2026-01-03 is 25 (sale yes, payment not yet)", (await opening("2026-01-03")) === 25);
        report("Opening balance on 2026-02-01 is 15 (25 - 10)", (await opening("2026-02-01")) === 15);

        const january = await customerStatementModel.getPeriodTotals(customerId, "2026-01-01", "2026-01-31", client);
        report("Period 01-01..01-31: credit 25, paid 10", Number(january.total_credit) === 25 && Number(january.total_paid) === 10);

        const later = await customerStatementModel.getPeriodTotals(customerId, "2026-01-03", "2026-01-31", client);
        report("Period 01-03..01-31: credit 0, paid 10", Number(later.total_credit) === 0 && Number(later.total_paid) === 10);

        const laterRows = await customerStatementModel.getStatementRows(customerId, "2026-01-03", "2026-01-31", client);
        report("Period rows only contain that period", laterRows.length === 1 && laterRows[0].kind === "payment");

        // ---------------- returns and stock (migration 004) ----------------
        // A tracked unit with stock 10
        const tracked = await productUnitModel.createProductUnit(product.product_id, "Carton", 20, 10, 1, client);
        await productUnitModel.decreaseStock(tracked.unit_id, 4, client);

        // credit wasl of the customer: 4 cartons = 80 (debt was 15 -> 95)
        const wasl2 = await waslModel.createWasl(kurdishName, customerId, "credit", 80, 0, 80, client);
        const item2 = await waslItemModel.createWaslItem(wasl2.wasl_id, product.product_id, tracked.unit_id, "Coal", "Carton", 4, 20, 80, client);
        await client.query("UPDATE wasls SET created_at = $1 WHERE wasl_id = $2", ["2026-01-10T09:00:00+03:00", wasl2.wasl_id]);

        const stockOf = async () => Number((await client.query("SELECT stock_quantity FROM product_units WHERE unit_id = $1", [tracked.unit_id])).rows[0].stock_quantity);
        report("Stock of a tracked unit goes down when it is sold (10 - 4 = 6)", (await stockOf()) === 6);

        const doReturn = async (requestId, waslRow, requested) => {
            const lines = await waslReturnModel.lockWaslItems(waslRow.wasl_id, client);
            const totals = await waslReturnModel.getReturnTotalsByWaslId(waslRow.wasl_id, client);
            const balanceCents = toCents(Number(await customerModel.getBalance(customerId, client)));
            const result = calculateReturn({
                wasl: waslRow, items: lines, requested,
                previous: { goodsCents: toCents(Number(totals.goods_amount)), netCents: toCents(Number(totals.net_amount)) },
                balanceCents,
            });
            const created = await waslReturnModel.createReturn(waslRow.wasl_id, requestId, fromCents(result.goodsCents), fromCents(result.netCents), fromCents(result.debtReductionCents), fromCents(result.refundCents), null, client);
            for (const line of result.lines) {
                await waslReturnModel.createReturnItem(created.return_id, line.wasl_item_id, line.quantity, line.unit_price, fromCents(line.grossCents), client);
                await waslReturnModel.addReturnedQuantity(line.wasl_item_id, line.quantity, client);
                if (line.item.unit_id !== null) await productUnitModel.increaseStock(line.item.unit_id, line.quantity, client);
            }
            return { created, result };
        };

        // debt before the return: 25 + 80 - 10 = 95
        const debtBefore = Number(await customerModel.getBalance(customerId, client));
        const first = await doReturn("check-return-0001", wasl2, [{ wasl_item_id: item2.wasl_item_id, quantity: 1 }]);   // worth 20
        report("Return of 1 carton: debt reduced by 20, nothing refunded in cash",
            first.result.debtReductionCents === 2000 && first.result.refundCents === 0 &&
            Number(await customerModel.getBalance(customerId, client)) === debtBefore - 20,
            `(debt ${debtBefore} -> ${await customerModel.getBalance(customerId, client)})`);
        report("Stock goes back up (6 + 1 = 7)", (await stockOf()) === 7);

        // the database itself refuses the same request id and an over-return
        let refusedDup = false, refusedOver = false, refusedNet = false;
        await client.query("SAVEPOINT s1");
        try { await waslReturnModel.createReturn(wasl2.wasl_id, "check-return-0001", 1, 1, 1, 0, null, client); } catch (e) { refusedDup = e.code === "23505"; }
        await client.query("ROLLBACK TO SAVEPOINT s1");
        await client.query("SAVEPOINT s2");
        try { await waslReturnModel.addReturnedQuantity(item2.wasl_item_id, 4, client); } catch (e) { refusedOver = e.code === "23514"; }
        await client.query("ROLLBACK TO SAVEPOINT s2");
        await client.query("SAVEPOINT s3");
        try { await waslReturnModel.createReturn(wasl2.wasl_id, "check-return-0099", 10, 10, 3, 3, null, client); } catch (e) { refusedNet = e.code === "23514"; }
        await client.query("ROLLBACK TO SAVEPOINT s3");
        report("Database refuses a repeated request id", refusedDup);
        report("Database refuses returning more than was sold", refusedOver);
        report("Database refuses a return whose debt + refund does not add up", refusedNet);

        // pay almost everything, then return the rest: the excess is refunded in cash
        const debtNow = Number(await customerModel.getBalance(customerId, client));
        await customerPaymentModel.createPayment(customerId, debtNow - 10, "2026-01-12", "almost all", client);
        const second = await doReturn("check-return-0002", wasl2, [{ wasl_item_id: item2.wasl_item_id, quantity: 3 }]);   // worth 60, debt 10
        report("Return worth 60 with debt 10: debt 10, cash refund 50, debt never negative",
            second.result.debtReductionCents === 1000 && second.result.refundCents === 5000 &&
            Number(await customerModel.getBalance(customerId, client)) === 0);
        report("Stock fully restored (10)", (await stockOf()) === 10);

        const items2 = await client.query("SELECT * FROM wasl_items WHERE wasl_id = $1", [wasl2.wasl_id]);
        report("Receipt status is 'full' when everything was returned", getReturnStatus(items2.rows.map((r) => ({ ...r, quantity: Number(r.quantity), returned_quantity: Number(r.returned_quantity) }))) === "full");
        const sumReturned = await client.query("SELECT COALESCE(SUM(quantity),0) AS q FROM wasl_return_items WHERE wasl_item_id = $1", [item2.wasl_item_id]);
        report("Returned quantity on the line equals the sum of its return rows", Number(sumReturned.rows[0].q) === Number(items2.rows[0].returned_quantity));

        // customer totals, lists and statement with returns
        const full2 = await customerModel.getCustomerById(customerId, client);
        report("Customer totals include returns: balance = credit - paid - returned",
            Math.round((Number(full2.total_credit) - Number(full2.total_paid) - Number(full2.total_returned)) * 100) === Math.round(Number(full2.balance) * 100) &&
            Number(full2.total_returned) === 30 && Number(full2.balance) === 0,
            `(credit ${full2.total_credit}, paid ${full2.total_paid}, returned ${full2.total_returned}, balance ${full2.balance})`);

        const stRows = await customerStatementModel.getStatementRows(customerId, null, null, client);
        const kinds = stRows.map((r) => r.kind);
        report("Complete statement has sale, payment, return and refund rows",
            ["sale", "payment", "return", "refund"].every((k) => kinds.includes(k)), `(${kinds.join(",")})`);
        const stTotals = await customerStatementModel.getPeriodTotals(customerId, null, null, client);
        report("Statement totals: remaining = credit - paid - returned = 0",
            Math.round((Number(stTotals.total_credit) - Number(stTotals.total_paid) - Number(stTotals.total_returned)) * 100) === 0, JSON.stringify(stTotals));
        // before 2026-01-11: credit 25 (01-02) + 80 (01-10), payment 10 (01-05).
        // The returns and the 01-12 payment are later, so they are not counted.
        const stOpening = await customerStatementModel.getOpeningBalance(customerId, "2026-01-11", client);
        report("Opening balance on 2026-01-11 is 95 (25 + 80 - 10)", Number(stOpening) === 95, `(${stOpening})`);

        const listed = await waslModel.getAllWasls(50);
        // getAllWasls uses its own connection and cannot see this uncommitted data, so only check it runs
        report("Wasl list query (with return status) runs", Array.isArray(listed));
        const byId = await client.query(
            `SELECT (SELECT CASE WHEN COALESCE(SUM(i.returned_quantity), 0) = 0 THEN 'none' WHEN BOOL_AND(i.returned_quantity = i.quantity) THEN 'full' ELSE 'partial' END FROM wasl_items i WHERE i.wasl_id = w.wasl_id) AS s FROM wasls w WHERE w.wasl_id = $1`, [wasl2.wasl_id]);
        report("SQL return_status of that wasl is 'full'", byId.rows[0].s === "full");

        // reports run and net sales / cash include the returns
        const rep = await client.query(`SELECT COALESCE(SUM(net_amount),0) AS r, COALESCE(SUM(refund_amount),0) AS f FROM wasl_returns WHERE wasl_id = $1`, [wasl2.wasl_id]);
        report("Return rows: returned 80 in total, 50 of it refunded in cash", Number(rep.rows[0].r) === 80 && Number(rep.rows[0].f) === 50, JSON.stringify(rep.rows[0]));
    } catch (error) {
        report("Credit workflow", false, error.message);
    } finally {
        await client.query("ROLLBACK"); // nothing stays in the database
        client.release();
    }

    // 5. The report and list queries (read-only) must run ----------------
    for (const [name, run] of [
        ["Report: summary", () => waslModel.getWaslSummary()],
        ["Report: today", () => waslModel.getTodayWasls()],
        ["Report: by date", () => waslModel.getWaslsByDate()],
        ["Report: top products", () => waslItemModel.getTopSellingProducts()],
        ["Customers with totals", () => customerModel.getAllCustomers()],
        ["Customers summary", () => customerModel.getCustomersSummary()],
        ["Products with stock", () => productModel.getAllProducts()],
    ]) {
        try { await run(); report(`${name} query runs`, true); }
        catch (error) { report(`${name} query runs`, false, error.message); }
    }

    console.log(failed === 0 ? "\nAll checks passed." : `\n${failed} check(s) failed.`);
};

runChecks()
    .catch((error) => {
        console.error("Check failed:", error.message);
        failed++;
    })
    .finally(async () => {
        await pool.end();
        process.exit(failed === 0 ? 0 : 1);
    });
