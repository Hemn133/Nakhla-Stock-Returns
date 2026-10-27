require("dotenv").config();

const express = require("express");
const cors = require("cors");
const pool = require("./config/db");

const productRoutes = require("./routes/productRoutes");
const waslRoutes = require("./routes/waslRoutes");
const customerRoutes = require("./routes/customerRoutes");

const app = express();

app.use(cors());
app.use(express.json());

app.use("/api/products", productRoutes);
app.use("/api/wasls", waslRoutes);
app.use("/api/customers", customerRoutes);

const PORT = process.env.PORT || 5000;

app.get("/", (req, res) => {
    res.json({
        message: "Nakhla API is running!"
    });
});

// Test PostgreSQL connection
app.get("/api/test-db", async (req, res) => {
    try {
        const result = await pool.query("SELECT NOW()");

        res.json({
            message: "PostgreSQL connection successful!",
            databaseTime: result.rows[0].now
        });
    } catch (error) {
        console.error("Database connection error:", error.message);

        res.status(500).json({
            message: "PostgreSQL connection failed.",
            error: error.message
        });
    }
});

app.listen(PORT, () => {
    console.log(`Nakhla server running on port ${PORT}`);
});
