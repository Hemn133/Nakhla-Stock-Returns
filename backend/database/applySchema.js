const fs = require("fs");
const path = require("path");

// Creates the tables of a NEW database and marks the migrations as already
// included, so db:migrate does not try to apply them again.
const applySchema = async (pool) => {
    // The database must be UTF8, otherwise Kurdish and Arabic text cannot be saved.
    const server = await pool.query(
        `SELECT
            current_setting('server_encoding') AS encoding,
            current_setting('server_version_num')::int AS version`
    );

    const { encoding, version } = server.rows[0];

    if (encoding !== "UTF8") {
        throw new Error(
            `This database uses the "${encoding}" encoding. Kurdish and Arabic need UTF8.\n` +
            "Drop the database and create it again like this:\n\n" +
            "  CREATE DATABASE nakhla_db\n" +
            "      WITH ENCODING 'UTF8'\n" +
            "      LC_COLLATE 'C' LC_CTYPE 'C'\n" +
            "      TEMPLATE template0;\n"
        );
    }

    if (version < 120000) {
        throw new Error("PostgreSQL 12 or newer is required.");
    }

    // A database that still has the dinar columns must be migrated, not recreated
    const oldSchema = await pool.query(
        `SELECT 1
         FROM information_schema.columns
         WHERE table_schema = 'public'
           AND table_name = 'wasls'
           AND column_name = 'currency'`
    );

    if (oldSchema.rows.length > 0) {
        throw new Error(
            "This database still has the old dinar + dollar tables.\n" +
            "Do NOT run db:setup on it. Upgrade it with:\n" +
            "  npm run db:audit      (shows what will be converted)\n" +
            "  npm run db:migrate    (after making a backup)"
        );
    }

    const schema = fs.readFileSync(
        path.join(__dirname, "schema.sql"),
        "utf8"
    );

    await pool.query(schema);

    await pool.query(
        `CREATE TABLE IF NOT EXISTS schema_migrations (
            name       VARCHAR(200) PRIMARY KEY,
            applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )`
    );

    const migrationsDir = path.join(__dirname, "migrations");

    for (const file of fs.readdirSync(migrationsDir)) {
        if (file.endsWith(".sql")) {
            await pool.query(
                `INSERT INTO schema_migrations (name)
                 VALUES ($1)
                 ON CONFLICT (name) DO NOTHING`,
                [file]
            );
        }
    }
};

module.exports = applySchema;
