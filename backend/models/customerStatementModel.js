const pool = require("../config/db");

// Days are Iraq days. A credit wasl and a return belong to the day they were
// created, a payment belongs to its paid_on date.
const WASL_DAY = "(w.created_at AT TIME ZONE 'Asia/Baghdad')::date";
const RETURN_DAY = "(r.created_at AT TIME ZONE 'Asia/Baghdad')::date";

// What the customer owed before "from"
// (credit wasls - payments - returns that lowered the debt)
const getOpeningBalance = async (customerId, from, db = pool) => {
    const result = await db.query(
        `SELECT
            COALESCE((
                SELECT SUM(w.total)
                FROM wasls w
                WHERE w.customer_id = $1
                  AND w.sale_type = 'credit'
                  AND ${WASL_DAY} < $2::date
            ), 0)
            -
            COALESCE((
                SELECT SUM(p.amount)
                FROM customer_payments p
                WHERE p.customer_id = $1
                  AND p.paid_on < $2::date
            ), 0)
            -
            COALESCE((
                SELECT SUM(r.debt_reduction)
                FROM wasl_returns r
                JOIN wasls w
                    ON w.wasl_id = r.wasl_id
                WHERE w.customer_id = $1
                  AND w.sale_type = 'credit'
                  AND ${RETURN_DAY} < $2::date
            ), 0) AS opening_balance`,
        [customerId, from]
    );

    return result.rows[0].opening_balance;
};

// Credit sales, payments and returns inside the period
// (from / to can be null = no limit).
// total_returned = what the returns took off the debt (not the cash refunded).
const getPeriodTotals = async (customerId, from, to, db = pool) => {
    const result = await db.query(
        `SELECT
            COALESCE((
                SELECT SUM(w.total)
                FROM wasls w
                WHERE w.customer_id = $1
                  AND w.sale_type = 'credit'
                  AND ($2::date IS NULL OR ${WASL_DAY} >= $2::date)
                  AND ($3::date IS NULL OR ${WASL_DAY} <= $3::date)
            ), 0) AS total_credit,
            COALESCE((
                SELECT SUM(p.amount)
                FROM customer_payments p
                WHERE p.customer_id = $1
                  AND ($2::date IS NULL OR p.paid_on >= $2::date)
                  AND ($3::date IS NULL OR p.paid_on <= $3::date)
            ), 0) AS total_paid,
            COALESCE((
                SELECT SUM(r.debt_reduction)
                FROM wasl_returns r
                JOIN wasls w
                    ON w.wasl_id = r.wasl_id
                WHERE w.customer_id = $1
                  AND w.sale_type = 'credit'
                  AND ($2::date IS NULL OR ${RETURN_DAY} >= $2::date)
                  AND ($3::date IS NULL OR ${RETURN_DAY} <= $3::date)
            ), 0) AS total_returned`,
        [customerId, from, to]
    );

    return result.rows[0];
};

// One row for every item of a credit wasl, every payment, every returned item
// ("return") and, when part of a return was paid back in cash, one "refund"
// row. Oldest first.
//   return rows - refund rows = what the returns took off the debt
const getStatementRows = async (customerId, from, to, db = pool) => {
    const result = await db.query(
        `SELECT *
         FROM (
             SELECT
                 'sale' AS kind,
                 TO_CHAR(${WASL_DAY}, 'YYYY-MM-DD') AS row_date,
                 w.created_at AS sort_at,
                 w.wasl_id AS wasl_id,
                 i.wasl_item_id AS row_id,
                 i.product_name AS title,
                 i.unit_name AS unit_name,
                 i.unit_price AS unit_price,
                 i.quantity AS quantity,
                 i.subtotal AS amount,
                 NULL::varchar AS note
             FROM wasls w
             JOIN wasl_items i
                 ON i.wasl_id = w.wasl_id
             WHERE w.customer_id = $1
               AND w.sale_type = 'credit'
               AND ($2::date IS NULL OR ${WASL_DAY} >= $2::date)
               AND ($3::date IS NULL OR ${WASL_DAY} <= $3::date)

             UNION ALL

             SELECT
                 'payment' AS kind,
                 TO_CHAR(p.paid_on, 'YYYY-MM-DD') AS row_date,
                 p.created_at AS sort_at,
                 NULL::integer AS wasl_id,
                 p.payment_id AS row_id,
                 NULL::varchar AS title,
                 NULL::varchar AS unit_name,
                 NULL::numeric AS unit_price,
                 NULL::numeric AS quantity,
                 p.amount AS amount,
                 p.note AS note
             FROM customer_payments p
             WHERE p.customer_id = $1
               AND ($2::date IS NULL OR p.paid_on >= $2::date)
               AND ($3::date IS NULL OR p.paid_on <= $3::date)

             UNION ALL

             SELECT
                 'return' AS kind,
                 TO_CHAR(${RETURN_DAY}, 'YYYY-MM-DD') AS row_date,
                 r.created_at AS sort_at,
                 r.wasl_id AS wasl_id,
                 ri.return_item_id AS row_id,
                 wi.product_name AS title,
                 wi.unit_name AS unit_name,
                 ri.unit_price AS unit_price,
                 ri.quantity AS quantity,
                 ri.amount AS amount,
                 NULL::varchar AS note
             FROM wasl_returns r
             JOIN wasls w
                 ON w.wasl_id = r.wasl_id
             JOIN wasl_return_items ri
                 ON ri.return_id = r.return_id
             JOIN wasl_items wi
                 ON wi.wasl_item_id = ri.wasl_item_id
             WHERE w.customer_id = $1
               AND w.sale_type = 'credit'
               AND ($2::date IS NULL OR ${RETURN_DAY} >= $2::date)
               AND ($3::date IS NULL OR ${RETURN_DAY} <= $3::date)

             UNION ALL

             SELECT
                 'refund' AS kind,
                 TO_CHAR(${RETURN_DAY}, 'YYYY-MM-DD') AS row_date,
                 r.created_at AS sort_at,
                 r.wasl_id AS wasl_id,
                 r.return_id AS row_id,
                 NULL::varchar AS title,
                 NULL::varchar AS unit_name,
                 NULL::numeric AS unit_price,
                 NULL::numeric AS quantity,
                 r.refund_amount AS amount,
                 NULL::varchar AS note
             FROM wasl_returns r
             JOIN wasls w
                 ON w.wasl_id = r.wasl_id
             WHERE w.customer_id = $1
               AND w.sale_type = 'credit'
               AND r.refund_amount > 0
               AND ($2::date IS NULL OR ${RETURN_DAY} >= $2::date)
               AND ($3::date IS NULL OR ${RETURN_DAY} <= $3::date)
         ) statement_rows
         ORDER BY row_date ASC, sort_at ASC, row_id ASC`,
        [customerId, from, to]
    );

    // row_date is text ("2026-10-14"), so no time zone can move the day
    return result.rows;
};

module.exports = {
    getOpeningBalance,
    getPeriodTotals,
    getStatementRows
};
