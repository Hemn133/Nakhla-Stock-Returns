const pool = require("../config/db");
const waslModel = require("../models/waslModel");
const waslItemModel = require("../models/waslItemModel");
const waslReturnModel = require("../models/waslReturnModel");
const customerModel = require("../models/customerModel");
const productUnitModel = require("../models/productUnitModel");
const { fromCents, toCents } = require("../utils/numbers");
const { calculateReturn, getReturnStatus } = require("../utils/returns");

// Error with an HTTP status, used for problems the user can fix
const fail = (status, message, code) => {
    const error = new Error(message);
    error.status = status;
    error.code = code;
    return error;
};

// The answer sent after a return (also for a repeated request)
const buildResponse = async (waslId, returnId, balanceAfter, duplicate) => {
    const items = await waslItemModel.getItemsByWaslId(waslId);
    const waslReturn = await waslReturnModel.getReturnById(returnId);

    return {
        message: duplicate
            ? "This return was already recorded."
            : "Return recorded successfully.",
        duplicate: duplicate,
        return: waslReturn,
        return_status: getReturnStatus(items),
        balance_after: balanceAfter
    };
};

// Return one product, several products or the whole wasl.
//   body: { request_id, note, items: [{ wasl_item_id, quantity }] }
//
// In ONE transaction:
//   1. the wasl (and for a credit wasl the customer) is locked
//   2. the quantities are checked against what is still eligible
//   3. the return and its products are saved (the wasl itself is never edited)
//   4. the returned quantity of every line goes up (the database refuses more
//      than was sold) and tracked stock is given back
//   5. cash wasl      -> the amount is refunded in cash
//      credit wasl    -> the debt goes down first, only the excess is refunded
// If anything fails, nothing is saved.
const createReturn = async (req, res) => {
    const waslId = Number(req.params.id);

    if (!Number.isInteger(waslId) || waslId <= 0) {
        return res.status(400).json({
            message: "Invalid wasl ID.",
            code: "INVALID"
        });
    }

    const { items, note, request_id } = req.body;

    if (
        typeof request_id !== "string" ||
        request_id.length < 8 ||
        request_id.length > 100
    ) {
        return res.status(400).json({
            message: "A request id is required.",
            code: "INVALID"
        });
    }

    const cleanNote =
        typeof note === "string" && note.trim()
            ? note.trim().slice(0, 255)
            : null;

    const client = await pool.connect();
    let transactionStarted = false;

    try {
        await client.query("BEGIN");
        transactionStarted = true;

        // Lock the wasl, so two returns of the same wasl never run together
        const wasl = await waslModel.getWaslForUpdate(waslId, client);

        if (!wasl) {
            throw fail(404, "Wasl not found.", "NOT_FOUND");
        }

        // The same request twice (double click, retry): nothing is applied again
        const existing = await waslReturnModel.getReturnByRequestId(
            request_id,
            client
        );

        if (existing) {
            if (existing.wasl_id !== waslId) {
                throw fail(409, "This request id was already used.", "REQUEST_REUSED");
            }

            await client.query("ROLLBACK");
            transactionStarted = false;

            let balanceAfter = null;

            if (wasl.sale_type === "credit") {
                balanceAfter = Number(
                    await customerModel.getBalance(wasl.customer_id)
                );
            }

            return res
                .status(200)
                .json(
                    await buildResponse(
                        waslId,
                        existing.return_id,
                        balanceAfter,
                        true
                    )
                );
        }

        const lines = await waslReturnModel.lockWaslItems(waslId, client);

        // A credit return changes the debt: lock the customer and read the debt
        let balanceCents = 0;

        if (wasl.sale_type === "credit") {
            await customerModel.lockCustomer(wasl.customer_id, client, true);

            balanceCents = toCents(
                Number(await customerModel.getBalance(wasl.customer_id, client))
            );
        }

        const previous = await waslReturnModel.getReturnTotalsByWaslId(
            waslId,
            client
        );

        // All the money rules are in utils/returns.js
        const result = calculateReturn({
            wasl: wasl,
            items: lines,
            requested: items,
            previous: {
                goodsCents: toCents(Number(previous.goods_amount)),
                netCents: toCents(Number(previous.net_amount))
            },
            balanceCents: balanceCents
        });

        const created = await waslReturnModel.createReturn(
            waslId,
            request_id,
            fromCents(result.goodsCents),
            fromCents(result.netCents),
            fromCents(result.debtReductionCents),
            fromCents(result.refundCents),
            cleanNote,
            client
        );

        for (const line of result.lines) {
            await waslReturnModel.createReturnItem(
                created.return_id,
                line.wasl_item_id,
                line.quantity,
                line.unit_price,
                fromCents(line.grossCents),
                client
            );

            await waslReturnModel.addReturnedQuantity(
                line.wasl_item_id,
                line.quantity,
                client
            );

            // Stock goes back (only for units whose stock is tracked)
            if (line.item.unit_id !== null) {
                await productUnitModel.increaseStock(
                    line.item.unit_id,
                    line.quantity,
                    client
                );
            }
        }

        await client.query("COMMIT");
        transactionStarted = false;

        const balanceAfter =
            wasl.sale_type === "credit"
                ? fromCents(balanceCents - result.debtReductionCents)
                : null;

        res.status(201).json(
            await buildResponse(waslId, created.return_id, balanceAfter, false)
        );
    } catch (error) {
        if (transactionStarted) {
            await client.query("ROLLBACK");
        }

        console.error("Error creating return:", error.message);

        if (error.status) {
            return res.status(error.status).json({
                message: error.message,
                code: error.code
            });
        }

        // Safety nets of the database itself
        if (error.code === "23514") {
            return res.status(409).json({
                message: "Cannot return more than was bought.",
                code: "EXCEEDS_ELIGIBLE"
            });
        }

        if (error.code === "23505") {
            return res.status(409).json({
                message: "This request id was already used.",
                code: "REQUEST_REUSED"
            });
        }

        res.status(500).json({
            message: "Failed to record the return."
        });
    } finally {
        client.release();
    }
};

const getReturns = async (req, res) => {
    try {
        const waslId = Number(req.params.id);

        if (!Number.isInteger(waslId) || waslId <= 0) {
            return res.status(400).json({
                message: "Invalid wasl ID."
            });
        }

        const wasl = await waslModel.getWaslById(waslId);

        if (!wasl) {
            return res.status(404).json({
                message: "Wasl not found."
            });
        }

        const returns = await waslReturnModel.getReturnsByWaslId(waslId);

        res.json(returns);
    } catch (error) {
        console.error("Error fetching returns:", error.message);

        res.status(500).json({
            message: "Failed to fetch returns."
        });
    }
};

module.exports = {
    createReturn,
    getReturns
};
