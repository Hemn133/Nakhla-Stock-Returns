const pool = require("../config/db");
const { RETURN_STATUS_SQL } = require("./waslReturnModel");

// A customer with the money that was sold on credit, the money already paid
// and what is still owed. The balance is always calculated, never stored:
//   balance = credit wasls - payments - returns that lowered the debt
const CUSTOMER_WITH_TOTALS = `
    SELECT
        c.customer_id,
        c.name,
        c.phone,
        c.address,
        c.notes,
        c.created_at,
        COALESCE(s.total_credit, 0) AS total_credit,
        COALESCE(p.total_paid, 0) AS total_paid,
        COALESCE(rt.total_returned, 0) AS total_returned,
        COALESCE(s.total_credit, 0)
            - COALESCE(p.total_paid, 0)
            - COALESCE(rt.total_returned, 0) AS balance,
        COALESCE(s.credit_sales_count, 0) AS credit_sales_count
    FROM customers c
    LEFT JOIN (
        SELECT
            customer_id,
            SUM(total) AS total_credit,
            COUNT(*) AS credit_sales_count
        FROM wasls
        WHERE sale_type = 'credit'
        GROUP BY customer_id
    ) s
        ON s.customer_id = c.customer_id
    LEFT JOIN (
        SELECT
            customer_id,
            SUM(amount) AS total_paid
        FROM customer_payments
        GROUP BY customer_id
    ) p
        ON p.customer_id = c.customer_id
    LEFT JOIN (
        SELECT
            w.customer_id,
            SUM(r.debt_reduction) AS total_returned
        FROM wasl_returns r
        JOIN wasls w
            ON w.wasl_id = r.wasl_id
        WHERE w.sale_type = 'credit'
        GROUP BY w.customer_id
    ) rt
        ON rt.customer_id = c.customer_id
`;

const getAllCustomers = async () => {
    const result = await pool.query(
        `${CUSTOMER_WITH_TOTALS}
         ORDER BY c.name COLLATE kurdish ASC`
    );

    return result.rows;
};

const getCustomerById = async (customerId, db = pool) => {
    const result = await db.query(
        `${CUSTOMER_WITH_TOTALS}
         WHERE c.customer_id = $1`,
        [customerId]
    );

    return result.rows[0];
};

const getCustomersSummary = async () => {
    const result = await pool.query(
        `SELECT
            COUNT(*) FILTER (WHERE balance > 0) AS debtors_count,
            COALESCE(SUM(balance) FILTER (WHERE balance > 0), 0) AS total_outstanding
         FROM (${CUSTOMER_WITH_TOTALS}) t`
    );

    return result.rows[0];
};

const createCustomer = async (name, phone, address, notes, db = pool) => {
    const result = await db.query(
        `INSERT INTO customers (name, phone, address, notes)
         VALUES ($1, $2, $3, $4)
         RETURNING customer_id`,
        [name, phone, address, notes]
    );

    return result.rows[0];
};

const updateCustomer = async (customerId, name, phone, address, notes) => {
    const result = await pool.query(
        `UPDATE customers
         SET
            name = $1,
            phone = $2,
            address = $3,
            notes = $4,
            updated_at = NOW()
         WHERE customer_id = $5
         RETURNING customer_id`,
        [name, phone, address, notes, customerId]
    );

    return result.rows[0];
};

const deleteCustomer = async (customerId) => {
    const result = await pool.query(
        `DELETE FROM customers
         WHERE customer_id = $1
         RETURNING customer_id, name`,
        [customerId]
    );

    return result.rows[0];
};

// Locks the customer row so two requests cannot change the debt at the same time.
// "FOR SHARE": a new credit sale (the debt only goes up).
// "FOR UPDATE": a payment or a deleted wasl (the debt goes down).
const lockCustomer = async (customerId, client, forUpdate = false) => {
    const result = await client.query(
        `SELECT customer_id, name
         FROM customers
         WHERE customer_id = $1
         ${forUpdate ? "FOR UPDATE" : "FOR SHARE"}`,
        [customerId]
    );

    return result.rows[0];
};

// What the customer owes right now
const getBalance = async (customerId, db = pool) => {
    const result = await db.query(
        `SELECT
            COALESCE((
                SELECT SUM(total)
                FROM wasls
                WHERE customer_id = $1
                  AND sale_type = 'credit'
            ), 0)
            -
            COALESCE((
                SELECT SUM(amount)
                FROM customer_payments
                WHERE customer_id = $1
            ), 0)
            -
            COALESCE((
                SELECT SUM(r.debt_reduction)
                FROM wasl_returns r
                JOIN wasls w
                    ON w.wasl_id = r.wasl_id
                WHERE w.customer_id = $1
                  AND w.sale_type = 'credit'
            ), 0) AS balance`,
        [customerId]
    );

    return result.rows[0].balance;
};

const getCreditSalesByCustomerId = async (customerId) => {
    const result = await pool.query(
        `SELECT
            w.wasl_id,
            w.total,
            w.created_at,
            ${RETURN_STATUS_SQL} AS return_status,
            (
                SELECT COUNT(*)
                FROM wasl_items i
                WHERE i.wasl_id = w.wasl_id
            ) AS item_count
         FROM wasls w
         WHERE w.customer_id = $1
           AND w.sale_type = 'credit'
         ORDER BY w.created_at DESC, w.wasl_id DESC`,
        [customerId]
    );

    return result.rows;
};

module.exports = {
    getAllCustomers,
    getCustomerById,
    getCustomersSummary,
    createCustomer,
    updateCustomer,
    deleteCustomer,
    lockCustomer,
    getBalance,
    getCreditSalesByCustomerId
};
