const pool = require("../config/db");
const { RETURN_STATUS_SQL } = require("./waslReturnModel");

const createWasl = async (
    customerName,
    customerId,
    saleType,
    subtotal,
    discount,
    total,
    client
) => {
    const result = await client.query(
        `INSERT INTO wasls
        (
            customer_name,
            customer_id,
            sale_type,
            subtotal,
            discount,
            total
        )
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING *`,
        [
            customerName,
            customerId,
            saleType,
            subtotal,
            discount,
            total
        ]
    );

    return result.rows[0];
};

// return_status: none | partial | full (from the real returned quantities)
const getAllWasls = async (limit) => {
    const result = await pool.query(
        `SELECT
            w.*,
            ${RETURN_STATUS_SQL} AS return_status,
            (
                SELECT COUNT(*)
                FROM wasl_items i
                WHERE i.wasl_id = w.wasl_id
            ) AS item_count
         FROM wasls w
         ORDER BY w.wasl_id DESC
         LIMIT $1`,
        [limit]
    );

    return result.rows;
};

const getWaslById = async (waslId) => {
    const result = await pool.query(
        `SELECT
            w.*,
            ${RETURN_STATUS_SQL} AS return_status
         FROM wasls w
         WHERE w.wasl_id = $1`,
        [waslId]
    );

    return result.rows[0];
};

// Locks the wasl while it is being deleted or returned
const getWaslForUpdate = async (waslId, client) => {
    const result = await client.query(
        `SELECT *
         FROM wasls
         WHERE wasl_id = $1
         FOR UPDATE`,
        [waslId]
    );

    return result.rows[0];
};

const deleteWasl = async (waslId, client) => {
    const result = await client.query(
        `DELETE FROM wasls
         WHERE wasl_id = $1
         RETURNING *`,
        [waslId]
    );

    return result.rows[0];
};

// Reports. All amounts are USD.
//   total_usd    = all wasls (cash + credit)      credit_usd = the part sold on credit
//   returns_usd  = value of returned goods         refunds_usd = cash paid back for returns
//   net_usd      = total_usd - returns_usd         (net sales)
//   payments_usd = installments received from customers
//   cash_usd     = cash sales + installments - refunds   (net cash received)
const getWaslSummary = async () => {
    const result = await pool.query(
        `WITH s AS (
             SELECT
                 COUNT(*) AS total_wasls,
                 COALESCE(SUM(total), 0) AS total_usd,
                 COALESCE(SUM(total) FILTER (WHERE sale_type = 'credit'), 0) AS credit_usd
             FROM wasls
         ),
         p AS (
             SELECT COALESCE(SUM(amount), 0) AS payments_usd
             FROM customer_payments
         ),
         r AS (
             SELECT
                 COALESCE(SUM(net_amount), 0) AS returns_usd,
                 COALESCE(SUM(refund_amount), 0) AS refunds_usd
             FROM wasl_returns
         )
         SELECT
             s.total_wasls,
             s.total_usd,
             s.credit_usd,
             p.payments_usd,
             r.returns_usd,
             r.refunds_usd,
             s.total_usd - r.returns_usd AS net_usd,
             (s.total_usd - s.credit_usd) + p.payments_usd - r.refunds_usd AS cash_usd
         FROM s, p, r`
    );

    return result.rows[0];
};

const getTodayWasls = async () => {
    const result = await pool.query(
        `WITH today AS (
             SELECT (NOW() AT TIME ZONE 'Asia/Baghdad')::date AS day
         ),
         s AS (
             SELECT
                 COUNT(*) AS total_wasls,
                 COALESCE(SUM(w.total), 0) AS total_usd,
                 COALESCE(SUM(w.total) FILTER (WHERE w.sale_type = 'credit'), 0) AS credit_usd
             FROM wasls w, today
             WHERE (w.created_at AT TIME ZONE 'Asia/Baghdad')::date = today.day
         ),
         p AS (
             SELECT COALESCE(SUM(c.amount), 0) AS payments_usd
             FROM customer_payments c, today
             WHERE c.paid_on = today.day
         ),
         r AS (
             SELECT
                 COALESCE(SUM(x.net_amount), 0) AS returns_usd,
                 COALESCE(SUM(x.refund_amount), 0) AS refunds_usd
             FROM wasl_returns x, today
             WHERE (x.created_at AT TIME ZONE 'Asia/Baghdad')::date = today.day
         )
         SELECT
             s.total_wasls,
             s.total_usd,
             s.credit_usd,
             p.payments_usd,
             r.returns_usd,
             r.refunds_usd,
             s.total_usd - r.returns_usd AS net_usd,
             (s.total_usd - s.credit_usd) + p.payments_usd - r.refunds_usd AS cash_usd
         FROM s, p, r`
    );

    return result.rows[0];
};

// One row per day that has wasls, payments or returns (days in Iraq time)
const getWaslsByDate = async () => {
    const result = await pool.query(
        `WITH sales AS (
             SELECT
                 TO_CHAR(created_at AT TIME ZONE 'Asia/Baghdad', 'YYYY-MM-DD') AS day,
                 COUNT(*) AS total_wasls,
                 SUM(total) AS total_usd,
                 COALESCE(SUM(total) FILTER (WHERE sale_type = 'credit'), 0) AS credit_usd
             FROM wasls
             GROUP BY 1
         ),
         paid AS (
             SELECT
                 TO_CHAR(paid_on, 'YYYY-MM-DD') AS day,
                 SUM(amount) AS payments_usd
             FROM customer_payments
             GROUP BY 1
         ),
         returned AS (
             SELECT
                 TO_CHAR(created_at AT TIME ZONE 'Asia/Baghdad', 'YYYY-MM-DD') AS day,
                 SUM(net_amount) AS returns_usd,
                 SUM(refund_amount) AS refunds_usd
             FROM wasl_returns
             GROUP BY 1
         ),
         days AS (
             SELECT day FROM sales
             UNION
             SELECT day FROM paid
             UNION
             SELECT day FROM returned
         )
         SELECT
             d.day AS wasl_date,
             COALESCE(s.total_wasls, 0) AS total_wasls,
             COALESCE(s.total_usd, 0) AS total_usd,
             COALESCE(s.credit_usd, 0) AS credit_usd,
             COALESCE(p.payments_usd, 0) AS payments_usd,
             COALESCE(r.returns_usd, 0) AS returns_usd,
             COALESCE(r.refunds_usd, 0) AS refunds_usd,
             COALESCE(s.total_usd, 0) - COALESCE(r.returns_usd, 0) AS net_usd,
             (COALESCE(s.total_usd, 0) - COALESCE(s.credit_usd, 0))
                 + COALESCE(p.payments_usd, 0)
                 - COALESCE(r.refunds_usd, 0) AS cash_usd
         FROM days d
         LEFT JOIN sales s ON s.day = d.day
         LEFT JOIN paid p ON p.day = d.day
         LEFT JOIN returned r ON r.day = d.day
         ORDER BY d.day ASC`
    );

    return result.rows;
};

module.exports = {
    createWasl,
    getAllWasls,
    getWaslById,
    getWaslForUpdate,
    deleteWasl,
    getWaslSummary,
    getTodayWasls,
    getWaslsByDate
};
