require("dotenv").config();

const pool = require("../config/db");

// Read-only report about the money stored in an OLD (dinar + dollar) database.
// Run it before the migration to see exactly what will be converted.
const audit = async () => {
    const oldSchema = await pool.query(
        `SELECT 1
         FROM information_schema.columns
         WHERE table_schema = 'public'
           AND table_name = 'wasls'
           AND column_name = 'currency'`
    );

    if (oldSchema.rows.length === 0) {
        console.log(
            "This database has no dinar columns. It is already USD only, nothing to audit."
        );
        return;
    }

    const units = await pool.query(
        `SELECT
            COUNT(*) AS total_units,
            COUNT(*) FILTER (WHERE price_usd IS NULL) AS dinar_only_units,
            COUNT(*) FILTER (WHERE price_usd IS NOT NULL AND price_iqd IS NOT NULL) AS both_prices,
            COUNT(*) FILTER (WHERE price_iqd IS NULL) AS dollar_only_units
         FROM product_units`
    );

    const wasls = await pool.query(
        `SELECT
            currency,
            COUNT(*) AS wasls,
            COALESCE(SUM(total), 0) AS total_in_own_currency,
            COALESCE(SUM(total_usd), 0) AS total_usd,
            MIN(exchange_rate) AS lowest_rate_used,
            MAX(exchange_rate) AS highest_rate_used
         FROM wasls
         GROUP BY currency
         ORDER BY currency`
    );

    const unit = units.rows[0];

    console.log("\nPRODUCT PRICES");
    console.log(`  units in total .............. ${unit.total_units}`);
    console.log(`  with a dollar price ......... ${Number(unit.total_units) - Number(unit.dinar_only_units)}`);
    console.log(`  dinar ONLY (need a rate) .... ${unit.dinar_only_units}`);

    if (Number(unit.dinar_only_units) > 0) {
        console.log(
            "  -> before migrating, choose the dinar-per-dollar rate for these prices:\n" +
            "     INSERT INTO settings (key, value) VALUES ('usd_migration_rate', '1500')\n" +
            "     ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;"
        );
    }

    console.log("\nWASLS (each dinar wasl is converted with the rate saved on it)");

    if (wasls.rows.length === 0) {
        console.log("  no wasls yet");
    }

    wasls.rows.forEach((row) => {
        console.log(
            `  ${row.currency}: ${row.wasls} wasl(s), total ${row.total_in_own_currency} ${row.currency}` +
            ` = ${row.total_usd} USD (rates ${row.lowest_rate_used} - ${row.highest_rate_used})`
        );
    });

    console.log(
        "\nThe original dinar figures are copied to the tables legacy_iqd_product_units," +
        "\nlegacy_iqd_wasls and legacy_iqd_wasl_items before anything is changed.\n"
    );
};

audit()
    .catch((error) => {
        console.error("Audit failed:", error.message);
        process.exitCode = 1;
    })
    .finally(() => pool.end());
