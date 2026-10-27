const pool = require("../config/db");

const createPayment = async (customerId, amount, paidOn, note, client) => {
    const result = await client.query(
        `INSERT INTO customer_payments
        (customer_id, amount, paid_on, note)
        VALUES ($1, $2, $3, $4)
        RETURNING *`,
        [
            customerId,
            amount,
            paidOn,
            note
        ]
    );

    return result.rows[0];
};

const getPaymentsByCustomerId = async (customerId) => {
    const result = await pool.query(
        `SELECT
            payment_id,
            customer_id,
            amount,
            TO_CHAR(paid_on, 'YYYY-MM-DD') AS paid_on,
            note,
            created_at
         FROM customer_payments
         WHERE customer_id = $1
         ORDER BY paid_on DESC, payment_id DESC`,
        [customerId]
    );

    return result.rows;
};

const deletePayment = async (paymentId, customerId) => {
    const result = await pool.query(
        `DELETE FROM customer_payments
         WHERE payment_id = $1
           AND customer_id = $2
         RETURNING payment_id`,
        [paymentId, customerId]
    );

    return result.rows[0];
};

module.exports = {
    createPayment,
    getPaymentsByCustomerId,
    deletePayment
};
