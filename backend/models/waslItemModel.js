const pool = require("../config/db");

const createWaslItem = async (
    waslId,
    productId,
    unitId,
    productName,
    unitName,
    quantity,
    unitPrice,
    subtotal,
    client
) => {
    const result = await client.query(
        `INSERT INTO wasl_items
        (
            wasl_id,
            product_id,
            unit_id,
            product_name,
            unit_name,
            quantity,
            unit_price,
            subtotal
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING *`,
        [
            waslId,
            productId,
            unitId,
            productName,
            unitName,
            quantity,
            unitPrice,
            subtotal
        ]
    );

    return result.rows[0];
};

const getItemsByWaslId = async (waslId) => {
    const result = await pool.query(
        `SELECT *
         FROM wasl_items
         WHERE wasl_id = $1
         ORDER BY wasl_item_id ASC`,
        [waslId]
    );

    return result.rows;
};

// Returned quantities and their value are taken off, so returns do not
// inflate the best-sellers
const getTopSellingProducts = async () => {
    const result = await pool.query(
        `SELECT
            product_name,
            unit_name,
            SUM(quantity - returned_quantity) AS total_quantity,
            SUM(
                subtotal - CASE
                    WHEN returned_quantity = quantity THEN subtotal
                    ELSE ROUND(unit_price * returned_quantity, 2)
                END
            ) AS revenue_usd
         FROM wasl_items
         GROUP BY
            product_name,
            unit_name
         HAVING SUM(quantity - returned_quantity) > 0
         ORDER BY total_quantity DESC`
    );

    return result.rows;
};

module.exports = {
    createWaslItem,
    getItemsByWaslId,
    getTopSellingProducts
};
