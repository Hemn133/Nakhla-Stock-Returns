const customerModel = require("../models/customerModel");
const waslReturnModel = require("../models/waslReturnModel");
const customerStatementModel = require("../models/customerStatementModel");
const {
    fromCents,
    isValidDateString,
    toCents,
    toEnglishDigits
} = require("../utils/numbers");

// Text field: trimmed, empty becomes null
const cleanText = (value, maxLength) => {
    if (typeof value !== "string" || !value.trim()) {
        return null;
    }

    return value.trim().slice(0, maxLength);
};

// Check the body of create / update customer.
// Returns { error } or the cleaned values.
const validateCustomerBody = (body) => {
    const { name, phone, address, notes } = body;

    if (typeof name !== "string" || !name.trim()) {
        return { error: "Customer name is required." };
    }

    if (name.trim().length > 150) {
        return { error: "Customer name is too long." };
    }

    // Phone numbers are saved with normal digits (0-9)
    let cleanPhone = null;

    if (typeof phone === "string" && phone.trim()) {
        cleanPhone = toEnglishDigits(phone).trim();

        if (!/^[0-9+\-\s()]{3,30}$/.test(cleanPhone)) {
            return { error: "Phone number is not valid." };
        }
    }

    return {
        name: name.trim(),
        phone: cleanPhone,
        address: cleanText(address, 255),
        notes: cleanText(notes, 2000)
    };
};

const parseCustomerId = (value) => {
    const customerId = Number(value);

    return Number.isInteger(customerId) && customerId > 0
        ? customerId
        : null;
};

const getCustomers = async (req, res) => {
    try {
        const customers = await customerModel.getAllCustomers();

        res.json(customers);
    } catch (error) {
        console.error("Get customers error:", error.message);

        res.status(500).json({
            message: "Failed to fetch customers."
        });
    }
};

const getCustomersSummary = async (req, res) => {
    try {
        const summary = await customerModel.getCustomersSummary();

        res.json(summary);
    } catch (error) {
        console.error("Get customers summary error:", error.message);

        res.status(500).json({
            message: "Failed to fetch customers summary."
        });
    }
};

const getCustomerById = async (req, res) => {
    try {
        const customerId = parseCustomerId(req.params.id);

        if (!customerId) {
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

        res.json(customer);
    } catch (error) {
        console.error("Get customer error:", error.message);

        res.status(500).json({
            message: "Failed to fetch customer."
        });
    }
};

const createCustomer = async (req, res) => {
    try {
        const validated = validateCustomerBody(req.body);

        if (validated.error) {
            return res.status(400).json({
                message: validated.error
            });
        }

        const created = await customerModel.createCustomer(
            validated.name,
            validated.phone,
            validated.address,
            validated.notes
        );

        const customer = await customerModel.getCustomerById(
            created.customer_id
        );

        res.status(201).json(customer);
    } catch (error) {
        console.error("Create customer error:", error.message);

        res.status(500).json({
            message: "Failed to create customer."
        });
    }
};

const updateCustomer = async (req, res) => {
    try {
        const customerId = parseCustomerId(req.params.id);

        if (!customerId) {
            return res.status(400).json({
                message: "Invalid customer ID."
            });
        }

        const validated = validateCustomerBody(req.body);

        if (validated.error) {
            return res.status(400).json({
                message: validated.error
            });
        }

        const updated = await customerModel.updateCustomer(
            customerId,
            validated.name,
            validated.phone,
            validated.address,
            validated.notes
        );

        if (!updated) {
            return res.status(404).json({
                message: "Customer not found."
            });
        }

        const customer = await customerModel.getCustomerById(customerId);

        res.json(customer);
    } catch (error) {
        console.error("Update customer error:", error.message);

        res.status(500).json({
            message: "Failed to update customer."
        });
    }
};

const deleteCustomer = async (req, res) => {
    try {
        const customerId = parseCustomerId(req.params.id);

        if (!customerId) {
            return res.status(400).json({
                message: "Invalid customer ID."
            });
        }

        const customer = await customerModel.deleteCustomer(customerId);

        if (!customer) {
            return res.status(404).json({
                message: "Customer not found."
            });
        }

        res.json({
            message: "Customer deleted successfully.",
            customer
        });
    } catch (error) {
        console.error("Delete customer error:", error.message);

        // Foreign key: the customer has credit wasls or payments
        if (error.code === "23503") {
            return res.status(409).json({
                message: "Cannot delete this customer because they have credit sales or payments."
            });
        }

        res.status(500).json({
            message: "Failed to delete customer."
        });
    }
};

const getCustomerSales = async (req, res) => {
    try {
        const customerId = parseCustomerId(req.params.id);

        if (!customerId) {
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

        const sales = await customerModel.getCreditSalesByCustomerId(
            customerId
        );

        res.json(sales);
    } catch (error) {
        console.error("Get customer sales error:", error.message);

        res.status(500).json({
            message: "Failed to fetch credit sales."
        });
    }
};

const getCustomerReturns = async (req, res) => {
    try {
        const customerId = parseCustomerId(req.params.id);

        if (!customerId) {
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

        const returns = await waslReturnModel.getReturnsByCustomerId(
            customerId
        );

        res.json(returns);
    } catch (error) {
        console.error("Get customer returns error:", error.message);

        res.status(500).json({
            message: "Failed to fetch returns."
        });
    }
};

// The combined statement of a customer.
//   no dates          -> complete statement (everything)
//   ?from=...&to=...  -> only that period, with the balance carried from before
// All money is calculated by the database and added in whole cents here.
const getCustomerStatement = async (req, res) => {
    try {
        const customerId = parseCustomerId(req.params.id);

        if (!customerId) {
            return res.status(400).json({
                message: "Invalid customer ID."
            });
        }

        const hasFrom = req.query.from !== undefined && req.query.from !== "";
        const hasTo = req.query.to !== undefined && req.query.to !== "";

        if (hasFrom !== hasTo) {
            return res.status(400).json({
                message: "Choose both a start date and an end date."
            });
        }

        if (hasFrom) {
            if (
                !isValidDateString(req.query.from) ||
                !isValidDateString(req.query.to)
            ) {
                return res.status(400).json({
                    message: "Dates must look like 2026-10-14."
                });
            }

            if (req.query.from > req.query.to) {
                return res.status(400).json({
                    message: "The start date must not be after the end date."
                });
            }
        }

        const from = hasFrom ? req.query.from : null;
        const to = hasTo ? req.query.to : null;

        const customer = await customerModel.getCustomerById(customerId);

        if (!customer) {
            return res.status(404).json({
                message: "Customer not found."
            });
        }

        const openingBalance = hasFrom
            ? await customerStatementModel.getOpeningBalance(customerId, from)
            : 0;

        const totals = await customerStatementModel.getPeriodTotals(
            customerId,
            from,
            to
        );

        const rows = await customerStatementModel.getStatementRows(
            customerId,
            from,
            to
        );

        const openingCents = toCents(Number(openingBalance));
        const creditCents = toCents(Number(totals.total_credit));
        const paidCents = toCents(Number(totals.total_paid));

        // total_returned = what returns took off the debt (the cash refunded is
        // not part of it)
        const returnedCents = toCents(Number(totals.total_returned));

        // total_owed = what was owed at the start + credit sold in the period
        const totalOwedCents = openingCents + creditCents;
        const remainingCents = totalOwedCents - paidCents - returnedCents;

        res.json({
            customer: {
                customer_id: customer.customer_id,
                name: customer.name,
                phone: customer.phone,
                address: customer.address
            },
            period: {
                from: from,
                to: to,
                is_complete: !hasFrom
            },
            opening_balance: fromCents(openingCents),
            total_credit: fromCents(creditCents),
            total_owed: fromCents(totalOwedCents),
            total_paid: fromCents(paidCents),
            total_returned: fromCents(returnedCents),
            remaining: fromCents(remainingCents),
            current_balance: Number(customer.balance),
            rows: rows
        });
    } catch (error) {
        console.error("Get customer statement error:", error.message);

        res.status(500).json({
            message: "Failed to create the statement."
        });
    }
};

module.exports = {
    getCustomers,
    getCustomersSummary,
    getCustomerById,
    createCustomer,
    updateCustomer,
    deleteCustomer,
    getCustomerSales,
    getCustomerReturns,
    getCustomerStatement
};
