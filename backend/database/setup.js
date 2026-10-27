require("dotenv").config();

const pool = require("../config/db");
const applySchema = require("./applySchema");

const setupDatabase = async () => {
    await applySchema(pool);

    console.log("Nakhla database tables are ready.");
    console.log("Run 'npm run db:check' to test the database.");

    await pool.end();
};

setupDatabase().catch((error) => {
    console.error("Database setup failed:", error.message);
    process.exit(1);
});
