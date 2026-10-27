const createProductUnit = async (
    productId,
    unitName,
    priceUsd,
    stockQuantity,
    position,
    client
) => {
    const result = await client.query(
        `INSERT INTO product_units
        (product_id, unit_name, price_usd, stock_quantity, position)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING *`,
        [
            productId,
            unitName,
            priceUsd,
            stockQuantity,
            position
        ]
    );

    return result.rows[0];
};

// Updating a unit in place keeps its id, so its stock and the wasls that
// were sold from it stay linked to it.
const updateProductUnit = async (
    unitId,
    productId,
    unitName,
    priceUsd,
    stockQuantity,
    position,
    client
) => {
    const result = await client.query(
        `UPDATE product_units
         SET
            unit_name = $3,
            price_usd = $4,
            stock_quantity = $5,
            position = $6
         WHERE unit_id = $1
           AND product_id = $2
         RETURNING *`,
        [
            unitId,
            productId,
            unitName,
            priceUsd,
            stockQuantity,
            position
        ]
    );

    return result.rows[0];
};

const getUnitIdsByProductId = async (productId, client) => {
    const result = await client.query(
        `SELECT unit_id
         FROM product_units
         WHERE product_id = $1`,
        [productId]
    );

    return result.rows.map((row) => row.unit_id);
};

const deleteUnitsByIds = async (unitIds, client) => {
    if (unitIds.length === 0) {
        return;
    }

    await client.query(
        `DELETE FROM product_units
         WHERE unit_id = ANY($1::int[])`,
        [unitIds]
    );
};

// Used while creating a wasl: unit + the name of its product.
// The unit row is locked so two sales cannot take the same stock.
const getUnitForWasl = async (unitId, client) => {
    const result = await client.query(
        `SELECT
            u.unit_id,
            u.product_id,
            u.unit_name,
            u.price_usd,
            u.stock_quantity,
            p.name AS product_name
         FROM product_units u
         JOIN products p
            ON p.product_id = u.product_id
         WHERE u.unit_id = $1
         FOR UPDATE OF u`,
        [unitId]
    );

    return result.rows[0];
};

// Only units whose stock is tracked (stock_quantity is not NULL) change.
// The CHECK on the table refuses a stock below 0.
const decreaseStock = async (unitId, quantity, client) => {
    await client.query(
        `UPDATE product_units
         SET stock_quantity = stock_quantity - $2
         WHERE unit_id = $1
           AND stock_quantity IS NOT NULL`,
        [unitId, quantity]
    );
};

const increaseStock = async (unitId, quantity, client) => {
    await client.query(
        `UPDATE product_units
         SET stock_quantity = stock_quantity + $2
         WHERE unit_id = $1
           AND stock_quantity IS NOT NULL`,
        [unitId, quantity]
    );
};

module.exports = {
    createProductUnit,
    updateProductUnit,
    getUnitIdsByProductId,
    deleteUnitsByIds,
    getUnitForWasl,
    decreaseStock,
    increaseStock
};
