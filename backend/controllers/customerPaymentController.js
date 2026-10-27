const pool = require("../config/db");
const customerModel = require("../models/customerModel");
const customerPaymentModel = require("../models/customerPaymentModel");
const {
    fromCents,
    getTodayInIraq,
    hasMaxTwoDecimals,
    isValidDateString,
    parseAmount,
    toCents
} = require("../utils/numbers");

// Error with an HTTP status, used for problems the user can fix
const fail = (status, message) => {
    const error = new Error(message);
    error.status = status;
    return error;
};

// Record money received from a customer (an installment).
// It lowers the debt only. Products are never touched.
const createPayment = async (req, res) => {
    const customerId = Number(req.params.id);

    if (!Number.isInteger(customerId) || customerId <= 0) {
        return res.status(400).json({
            message: "Invalid customer ID."
        });
    }

    const amount = parseAmount(req.body.amount);

    if (
        amount === null ||
        amount <= 0 ||
        amount > 1000000000 ||
        !hasMaxTwoDecimals(amount)
    ) {
        return res.status(400).json({
            message: "Payment amount must be greater than zero (at most 2 decimals)."
        });
    }

    // Date of the payment: today, or an earlier day, never in the future
    const today = getTodayInIraq();
    const paidOn =
        req.body.paid_on === undefined ||
        req.body.paid_on === null ||
        req.body.paid_on === ""
            ? today
            : req.body.paid_on;

    if (!isValidDateString(paidOn)) {
        return res.status(400).json({
            message: "Payment date must look like 2026-10-14."
        });
    }

    if (paidOn > today) {
        return res.status(400).json({
            message: "Payment date cannot be in the future."
        });
    }

    const note =
        typeof req.body.note === "string" && req.body.note.trim()
            ? req.body.note.trim().slice(0, 255)
            : null;

    const client = await pool.connect();
    let transactionStarted = false;

    try {
        await client.query("BEGIN");
        transactionStarted = true;

        // Lock the customer so two payments cannot spend the same debt
        const customer = await customerModel.lockCustomer(
            customerId,
            client,
            true
        );

        if (!customer) {
            throw fail(404, "Customer not found.");
        }

        const balanceCents = toCents(
            Number(await customerModel.getBalance(customerId, client))
        );

        if (balanceCents <= 0) {
            throw fail(400, "This customer has no debt.");
        }

        const amountCents = toCents(amount);

        if (amountCents > balanceCents) {
            throw fail(
                400,
                `Payment is larger than the remaining debt (${fromCents(balanceCents)}).`
            );
        }

        const payment = await customerPaymentModel.createPayment(
            customerId,
            fromCents(amountCents),
            paidOn,
            note,
            client
        );

        await client.query("COMMIT");
        transactionStarted = false;

        res.status(201).json({
            message: "Payment recorded successfully.",
            payment: payment,
            balance_after: fromCents(balanceCents - amountCents)
        });
    } catch (error) {
        if (transactionStarted) {
            await client.query("ROLLBACK");
        }

        console.error("Create customer payment error:", error.message);

        if (error.status) {
            return res.status(error.status).json({
                message: error.message
            });
        }

        res.status(500).json({
            message: "Failed to record the payment."
        });
    } finally {
        client.release();
    }
};

const getPayments = async (req, res) => {
    try {
        const customerId = Number(req.params.id);

        if (!Number.isInteger(customerId) || customerId <= 0) {
            return res.status(400).json({
                message: "Invalid customer ID."
            });
        }

        const customer = await customerModel.getCustomerById(customerId);

        if (!customer) {
            return res.status(404).json({
                message: "Customer not found."
            });
        }

        const payments = await customerPaymentModel.getPaymentsByCustomerId(
            customerId
        );

        res.json(payments);
    } catch (error) {
        console.error("Get customer payments error:", error.message);

        res.status(500).json({
            message: "Failed to fetch payments."
        });
    }
};

// A wrongly entered payment can be removed (the debt goes up again)
const deletePayment = async (req, res) => {
    try {
        const customerId = Number(req.params.id);
        const paymentId = Number(req.params.paymentId);

        if (
            !Number.isInteger(customerId) ||
            customerId <= 0 ||
            !Number.isInteger(paymentId) ||
            paymentId <= 0
        ) {
            return res.status(400).json({
                message: "Invalid ID."
            });
        }

        const payment = await customerPaymentModel.deletePayment(
            paymentId,
            customerId
        );

        if (!payment) {
            return res.status(404).json({
                message: "Payment not found."
            });
        }

        res.json({
            message: "Payment deleted successfully."
        });
    } catch (error) {
        console.error("Delete customer payment error:", error.message);

        res.status(500).json({
            message: "Failed to delete the payment."
        });
    }
};

module.exports = {
    createPayment,
    getPayments,
    deletePayment
};
