const pool = require("../config/db");

// Product with all of its units packed into one "units" array
const PRODUCT_WITH_UNITS = `
    SELECT
        p.product_id,
        p.name,
        p.created_at,
        p.updated_at,
        COALESCE(
            json_agg(
                json_build_object(
                    'unit_id', u.unit_id,
                    'unit_name', u.unit_name,
                    'price_usd', u.price_usd,
                    'stock_quantity', u.stock_quantity
                )
                ORDER BY u.position, u.unit_id
            ) FILTER (WHERE u.unit_id IS NOT NULL),
            '[]'
        ) AS units
    FROM products p
    LEFT JOIN product_units u
        ON u.product_id = p.product_id
`;

const getAllProducts = async () => {
    const result = await pool.query(
        `${PRODUCT_WITH_UNITS}
         GROUP BY p.product_id
         ORDER BY p.name COLLATE kurdish ASC`
    );

    return result.rows;
};

const getProductById = async (productId, db = pool) => {
    const result = await db.query(
        `${PRODUCT_WITH_UNITS}
         WHERE p.product_id = $1
         GROUP BY p.product_id`,
        [productId]
    );

    return result.rows[0];
};

const createProduct = async (name, client) => {
    const result = await client.query(
        `INSERT INTO products (name)
         VALUES ($1)
         RETURNING *`,
        [name]
    );

    return result.rows[0];
};

const updateProduct = async (productId, name, client) => {
    const result = await client.query(
        `UPDATE products
         SET
            name = $1,
            updated_at = NOW()
         WHERE product_id = $2
         RETURNING *`,
        [name, productId]
    );

    return result.rows[0];
};

const deleteProduct = async (productId) => {
    const result = await pool.query(
        `DELETE FROM products
         WHERE product_id = $1
         RETURNING *`,
        [productId]
    );

    return result.rows[0];
};

module.exports = {
    getAllProducts,
    getProductById,
    createProduct,
    updateProduct,
    deleteProduct
};
