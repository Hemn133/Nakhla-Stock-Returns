const path = require("path");
const { Pool, types } = require("pg");

// PostgreSQL returns NUMERIC and COUNT/SUM(bigint) values as strings.
// Convert them to real numbers so the frontend can use them directly.
types.setTypeParser(1700, (value) => parseFloat(value)); // NUMERIC
types.setTypeParser(20, (value) => parseInt(value, 10)); // BIGINT (COUNT)

const password =
    process.env.DB_PASSWORD ??
    process.env.DB_PASS ??
    process.env.PGPASSWORD;

// dotenv reads the .env file from the folder where the server is started
if (password === undefined) {
    console.error(
        "\n[Nakhla] DB_PASSWORD was not found.\n" +
        `  1. Create a file named .env inside: ${process.cwd()}\n` +
        "     (copy .env.example to .env)\n" +
        "  2. Put your PostgreSQL password in it:  DB_PASSWORD=your_password\n" +
        "  3. Stop the server (Ctrl+C) and start it again.\n"
    );
}

const pool = new Pool({
    host: process.env.DB_HOST || "localhost",
    port: Number(process.env.DB_PORT) || 5432,
    user: process.env.DB_USER || "postgres",
    password: password,
    database: process.env.DB_NAME || "nakhla_db"
});

module.exports = pool;
