require("dotenv").config();

const pool = require("../config/db");
const applySchema = require("./applySchema");

// Deletes every Nakhla table and creates them again (ALL DATA IS LOST).
const resetDatabase = async () => {
    if (!process.argv.includes("--yes")) {
        console.log("This DELETES all Nakhla data.");
        console.log("To continue run:  npm run db:reset -- --yes");
        await pool.end();
        return;
    }

    await pool.query(
        `DROP TABLE IF EXISTS
            wasl_return_items,
            wasl_returns,
            wasl_items,
            wasls,
            customer_payments,
            customers,
            product_units,
            products,
            settings,
            currencies,
            legacy_iqd_wasl_items,
            legacy_iqd_wasls,
            legacy_iqd_product_units,
            schema_migrations
         CASCADE;

         DROP FUNCTION IF EXISTS
            format_money(NUMERIC, TEXT),
            parse_number(TEXT),
            arabic_digits(TEXT),
            normalize_text(TEXT),
            normalize_digits(TEXT)
         CASCADE;

         DROP COLLATION IF EXISTS kurdish;`
    );

    await applySchema(pool);

    console.log("Nakhla database was reset.");
    await pool.end();
};

resetDatabase().catch((error) => {
    console.error("Database reset failed:", error.message);
    process.exit(1);
});
