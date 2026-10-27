require("dotenv").config();

const fs = require("fs");
const path = require("path");
const pool = require("../config/db");

const MIGRATIONS_DIR = path.join(__dirname, "migrations");

// Applies every file of database/migrations that was not applied yet.
// Each file runs in its own transaction: it fully succeeds or changes nothing.
const migrate = async () => {
    const client = await pool.connect();

    try {
        await client.query(
            `CREATE TABLE IF NOT EXISTS schema_migrations (
                name       VARCHAR(200) PRIMARY KEY,
                applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            )`
        );

        const appliedResult = await client.query(
            "SELECT name FROM schema_migrations"
        );

        const applied = new Set(appliedResult.rows.map((row) => row.name));

        const files = fs
            .readdirSync(MIGRATIONS_DIR)
            .filter((file) => file.endsWith(".sql"))
            .sort();

        let appliedCount = 0;

        for (const file of files) {
            if (applied.has(file)) {
                console.log(`Already applied: ${file}`);
                continue;
            }

            console.log(`Applying ${file} ...`);

            const sql = fs.readFileSync(
                path.join(MIGRATIONS_DIR, file),
                "utf8"
            );

            await client.query("BEGIN");

            try {
                await client.query(sql);

                await client.query(
                    "INSERT INTO schema_migrations (name) VALUES ($1)",
                    [file]
                );

                await client.query("COMMIT");
            } catch (error) {
                await client.query("ROLLBACK");

                console.error(`\n${file} failed. Nothing was changed.`);
                throw error;
            }

            appliedCount++;
            console.log(`Applied ${file}`);
        }

        console.log(
            appliedCount === 0
                ? "The database is up to date."
                : `Done. ${appliedCount} migration(s) applied.`
        );
    } finally {
        client.release();
        await pool.end();
    }
};

migrate().catch((error) => {
    console.error(error.message);
    process.exit(1);
});
