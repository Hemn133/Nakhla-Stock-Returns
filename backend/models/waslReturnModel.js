const pool = require("../config/db");

// "none" | "partial" | "full" worked out from the real returned quantities
const RETURN_STATUS_SQL = `
    (
        SELECT CASE
            WHEN COALESCE(SUM(i.returned_quantity), 0) = 0 THEN 'none'
            WHEN BOOL_AND(i.returned_quantity = i.quantity) THEN 'full'
            ELSE 'partial'
        END
        FROM wasl_items i
        WHERE i.wasl_id = w.wasl_id
    )
`;

// Every return with its products packed into an "items" array
const RETURNS_WITH_ITEMS = `
    SELECT
        r.return_id,
        r.wasl_id,
        r.goods_amount,
        r.net_amount,
        r.debt_reduction,
        r.refund_amount,
        r.note,
        r.created_at,
        COALESCE(
            json_agg(
                json_build_object(
                    'wasl_item_id', ri.wasl_item_id,
                    'product_name', wi.product_name,
                    'unit_name', wi.unit_name,
                    'quantity', ri.quantity,
                    'unit_price', ri.unit_price,
                    'amount', ri.amount
                )
                ORDER BY ri.return_item_id
            ) FILTER (WHERE ri.return_item_id IS NOT NULL),
            '[]'
        ) AS items
    FROM wasl_returns r
    LEFT JOIN wasl_return_items ri
        ON ri.return_id = r.return_id
    LEFT JOIN wasl_items wi
        ON wi.wasl_item_id = ri.wasl_item_id
`;

// Locks the lines of a wasl while a return is being made
const lockWaslItems = async (waslId, client) => {
    const result = await client.query(
        `SELECT *
         FROM wasl_items
         WHERE wasl_id = $1
         ORDER BY wasl_item_id ASC
         FOR UPDATE`,
        [waslId]
    );

    return result.rows;
};

const getReturnByRequestId = async (requestId, client) => {
    const result = await client.query(
        `SELECT *
         FROM wasl_returns
         WHERE request_id = $1`,
        [requestId]
    );

    return result.rows[0];
};

// Money already returned from this wasl by earlier returns
const getReturnTotalsByWaslId = async (waslId, client) => {
    const result = await client.query(
        `SELECT
            COALESCE(SUM(goods_amount), 0) AS goods_amount,
            COALESCE(SUM(net_amount), 0) AS net_amount
         FROM wasl_returns
         WHERE wasl_id = $1`,
        [waslId]
    );

    return result.rows[0];
};

const countReturnsByWaslId = async (waslId, client) => {
    const result = await client.query(
        `SELECT COUNT(*) AS count
         FROM wasl_returns
         WHERE wasl_id = $1`,
        [waslId]
    );

    return result.rows[0].count;
};

const createReturn = async (
    waslId,
    requestId,
    goodsAmount,
    netAmount,
    debtReduction,
    refundAmount,
    note,
    client
) => {
    const result = await client.query(
        `INSERT INTO wasl_returns
        (
            wasl_id,
            request_id,
            goods_amount,
            net_amount,
            debt_reduction,
            refund_amount,
            note
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING *`,
        [
            waslId,
            requestId,
            goodsAmount,
            netAmount,
            debtReduction,
            refundAmount,
            note
        ]
    );

    return result.rows[0];
};

const createReturnItem = async (
    returnId,
    waslItemId,
    quantity,
    unitPrice,
    amount,
    client
) => {
    const result = await client.query(
        `INSERT INTO wasl_return_items
        (return_id, wasl_item_id, quantity, unit_price, amount)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING *`,
        [returnId, waslItemId, quantity, unitPrice, amount]
    );

    return result.rows[0];
};

// The line now has more returned quantity. The CHECK on wasl_items makes the
// database refuse it if it would go above the quantity that was sold.
const addReturnedQuantity = async (waslItemId, quantity, client) => {
    await client.query(
        `UPDATE wasl_items
         SET returned_quantity = returned_quantity + $2
         WHERE wasl_item_id = $1`,
        [waslItemId, quantity]
    );
};

const getReturnsByWaslId = async (waslId, db = pool) => {
    const result = await db.query(
        `${RETURNS_WITH_ITEMS}
         WHERE r.wasl_id = $1
         GROUP BY r.return_id
         ORDER BY r.return_id ASC`,
        [waslId]
    );

    return result.rows;
};

const getReturnById = async (returnId, db = pool) => {
    const result = await db.query(
        `${RETURNS_WITH_ITEMS}
         WHERE r.return_id = $1
         GROUP BY r.return_id`,
        [returnId]
    );

    return result.rows[0];
};

// Returns of the credit wasls of one customer
const getReturnsByCustomerId = async (customerId) => {
    const result = await pool.query(
        `${RETURNS_WITH_ITEMS}
         JOIN wasls w
             ON w.wasl_id = r.wasl_id
         WHERE w.customer_id = $1
           AND w.sale_type = 'credit'
         GROUP BY r.return_id
         ORDER BY r.created_at DESC, r.return_id DESC`,
        [customerId]
    );

    return result.rows;
};

module.exports = {
    RETURN_STATUS_SQL,
    lockWaslItems,
    getReturnByRequestId,
    getReturnTotalsByWaslId,
    countReturnsByWaslId,
    createReturn,
    createReturnItem,
    addReturnedQuantity,
    getReturnsByWaslId,
    getReturnById,
    getReturnsByCustomerId
};
