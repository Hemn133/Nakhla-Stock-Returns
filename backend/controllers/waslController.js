const pool = require("../config/db");
const waslModel = require("../models/waslModel");
const waslItemModel = require("../models/waslItemModel");
const productUnitModel = require("../models/productUnitModel");
const customerModel = require("../models/customerModel");
const waslReturnModel = require("../models/waslReturnModel");
const { getReturnStatus } = require("../utils/returns");
const {
    fromCents,
    hasMaxTwoDecimals,
    parseAmount,
    toCents
} = require("../utils/numbers");

// Small helpers ---------------------------------------------------

// Error with an HTTP status, used for problems the user can fix
const fail = (status, message, code) => {
    const error = new Error(message);
    error.status = status;
    error.code = code;
    return error;
};

// Check one item of the request. Returns an error message or null.
const validateItem = (item) => {
    if (!item || typeof item !== "object") {
        return "Invalid wasl item.";
    }

    const quantity = parseAmount(item.quantity);

    if (
        quantity === null ||
        Math.round(quantity * 1000) < 1 ||
        quantity > 100000
    ) {
        return "Item quantity must be greater than zero.";
    }

    // Item from the product list
    if (item.unit_id !== undefined && item.unit_id !== null) {
        if (
            !Number.isInteger(Number(item.unit_id)) ||
            Number(item.unit_id) <= 0
        ) {
            return "Invalid unit ID.";
        }

        return null;
    }

    // Manual item (name + price in USD)
    if (typeof item.name !== "string" || !item.name.trim()) {
        return "Manual items need a name.";
    }

    const price = parseAmount(item.price);

    if (
        price === null ||
        price < 0 ||
        price > 10000000 ||
        !hasMaxTwoDecimals(price)
    ) {
        return "Manual items need a valid price in USD.";
    }

    return null;
};

// Controllers -----------------------------------------------------

const createWasl = async (req, res) => {
    const {
        customer_name,
        customer_id,
        sale_type,
        currency,
        discount,
        items
    } = req.body;

    // The system uses USD only
    if (currency !== undefined && currency !== "USD") {
        return res.status(400).json({
            message: "Only USD is supported."
        });
    }

    // Cash (paid now) or credit (added to the debt of a customer)
    const saleType = sale_type === undefined ? "cash" : sale_type;

    if (saleType !== "cash" && saleType !== "credit") {
        return res.status(400).json({
            message: "Sale type must be cash or credit."
        });
    }

    // Check items
    if (!Array.isArray(items) || items.length === 0 || items.length > 200) {
        return res.status(400).json({
            message: "Wasl must contain between 1 and 200 items."
        });
    }

    for (const item of items) {
        const message = validateItem(item);

        if (message) {
            return res.status(400).json({ message });
        }
    }

    // Check discount (in USD)
    const discountAmount =
        discount === undefined || discount === null || discount === ""
            ? 0
            : parseAmount(discount);

    if (
        discountAmount === null ||
        discountAmount < 0 ||
        !hasMaxTwoDecimals(discountAmount)
    ) {
        return res.status(400).json({
            message: "Discount must be zero or more."
        });
    }

    // Credit sales need a customer and cannot have a discount
    let customerId = null;

    if (saleType === "credit") {
        customerId = Number(customer_id);

        if (!Number.isInteger(customerId) || customerId <= 0) {
            return res.status(400).json({
                message: "A customer is required for credit sales."
            });
        }

        if (discountAmount !== 0) {
            return res.status(400).json({
                message: "Credit sales cannot have a discount."
            });
        }
    }

    let customerName =
        typeof customer_name === "string" && customer_name.trim()
            ? customer_name.trim().slice(0, 150)
            : null;

    const client = await pool.connect();
    let transactionStarted = false;

    try {
        await client.query("BEGIN");
        transactionStarted = true;

        if (saleType === "credit") {
            const customer = await customerModel.lockCustomer(
                customerId,
                client
            );

            if (!customer) {
                throw fail(404, "Customer not found.");
            }

            // The wasl keeps the name the customer had at the time of the sale
            customerName = customer.name;
        }

        // All money is calculated in whole cents on the server
        let subtotalCents = 0;
        const waslItems = [];

        for (const item of items) {
            const quantity =
                Math.round(parseAmount(item.quantity) * 1000) / 1000;

            let productId = null;
            let unitId = null;
            let productName;
            let unitName = null;
            let priceCents;

            if (item.unit_id !== undefined && item.unit_id !== null) {
                // Prices always come from the database, never from the client
                const unit = await productUnitModel.getUnitForWasl(
                    Number(item.unit_id),
                    client
                );

                if (!unit) {
                    throw fail(404, `Unit ${item.unit_id} not found.`);
                }

                productId = unit.product_id;
                unitId = unit.unit_id;
                productName = unit.product_name;
                unitName = unit.unit_name;
                priceCents = toCents(Number(unit.price_usd));

                // A unit with tracked stock cannot be sold below 0.
                // (stock_quantity NULL = not tracked, nothing to check)
                if (unit.stock_quantity !== null) {
                    const stockThousandths = Math.round(
                        Number(unit.stock_quantity) * 1000
                    );

                    if (stockThousandths < Math.round(quantity * 1000)) {
                        throw fail(
                            409,
                            `Not enough stock for "${unit.product_name} - ${unit.unit_name}" (available: ${Number(unit.stock_quantity)}).`,
                            "NOT_ENOUGH_STOCK"
                        );
                    }

                    await productUnitModel.decreaseStock(
                        unit.unit_id,
                        quantity,
                        client
                    );
                }
            } else {
                productName = item.name.trim().slice(0, 150);
                priceCents = toCents(parseAmount(item.price));
            }

            const lineCents = Math.round(priceCents * quantity);

            subtotalCents += lineCents;

            waslItems.push({
                productId,
                unitId,
                productName,
                unitName,
                quantity,
                unitPrice: fromCents(priceCents),
                subtotal: fromCents(lineCents)
            });
        }

        const discountCents = toCents(discountAmount);

        if (discountCents > subtotalCents) {
            throw fail(400, "Discount cannot be larger than the subtotal.");
        }

        const totalCents = subtotalCents - discountCents;

        const wasl = await waslModel.createWasl(
            customerName,
            customerId,
            saleType,
            fromCents(subtotalCents),
            fromCents(discountCents),
            fromCents(totalCents),
            client
        );

        const savedItems = [];

        for (const item of waslItems) {
            const savedItem = await waslItemModel.createWaslItem(
                wasl.wasl_id,
                item.productId,
                item.unitId,
                item.productName,
                item.unitName,
                item.quantity,
                item.unitPrice,
                item.subtotal,
                client
            );

            savedItems.push(savedItem);
        }

        await client.query("COMMIT");
        transactionStarted = false;

        res.status(201).json({
            message: "Wasl created successfully.",
            wasl: wasl,
            items: savedItems
        });
    } catch (error) {
        if (transactionStarted) {
            await client.query("ROLLBACK");
        }

        console.error("Error creating wasl:", error.message);

        if (error.status) {
            return res.status(error.status).json({
                message: error.message,
                code: error.code
            });
        }

        res.status(500).json({
            message: "Failed to create wasl."
        });
    } finally {
        client.release();
    }
};

const getWasls = async (req, res) => {
    try {
        const limit = Math.min(
            Math.max(parseInt(req.query.limit, 10) || 300, 1),
            1000
        );

        const wasls = await waslModel.getAllWasls(limit);

        res.status(200).json(wasls);
    } catch (error) {
        console.error("Error fetching wasls:", error.message);

        res.status(500).json({
            message: "Failed to fetch wasls."
        });
    }
};

const getWaslById = async (req, res) => {
    try {
        const waslId = Number(req.params.id);

        if (!Number.isInteger(waslId) || waslId <= 0) {
            return res.status(400).json({
                message: "Invalid wasl ID."
            });
        }

        const wasl = await waslModel.getWaslById(waslId);

        if (!wasl) {
            return res.status(404).json({
                message: "Wasl not found."
            });
        }

        const items = await waslItemModel.getItemsByWaslId(waslId);
        const returns = await waslReturnModel.getReturnsByWaslId(waslId);

        res.status(200).json({
            wasl: wasl,
            items: items,
            returns: returns,
            return_status: getReturnStatus(items)
        });
    } catch (error) {
        console.error("Error fetching wasl:", error.message);

        res.status(500).json({
            message: "Failed to fetch wasl."
        });
    }
};

const deleteWasl = async (req, res) => {
    const waslId = Number(req.params.id);

    if (!Number.isInteger(waslId) || waslId <= 0) {
        return res.status(400).json({
            message: "Invalid wasl ID."
        });
    }

    const client = await pool.connect();
    let transactionStarted = false;

    try {
        await client.query("BEGIN");
        transactionStarted = true;

        const wasl = await waslModel.getWaslForUpdate(waslId, client);

        if (!wasl) {
            throw fail(404, "Wasl not found.");
        }

        // A wasl that has returns is part of the financial history (refunds,
        // customer debt, reports), so it is kept.
        const returnsCount = await waslReturnModel.countReturnsByWaslId(
            waslId,
            client
        );

        if (returnsCount > 0) {
            throw fail(
                409,
                "This wasl has returns, so it cannot be deleted.",
                "HAS_RETURNS"
            );
        }

        // Deleting a credit wasl lowers the debt of its customer.
        // It is only allowed while the customer has not already paid more
        // than what would remain.
        if (wasl.sale_type === "credit") {
            await customerModel.lockCustomer(wasl.customer_id, client, true);

            const balanceCents = toCents(
                Number(await customerModel.getBalance(wasl.customer_id, client))
            );

            if (balanceCents - toCents(Number(wasl.total)) < 0) {
                throw fail(
                    409,
                    "This credit wasl cannot be deleted because the customer has already paid more than the remaining debt.",
                    "BALANCE_TOO_LOW"
                );
            }
        }

        // The goods of a deleted wasl go back into stock (tracked units only)
        const items = await waslItemModel.getItemsByWaslId(waslId);

        for (const item of items) {
            if (item.unit_id !== null) {
                await productUnitModel.increaseStock(
                    item.unit_id,
                    Number(item.quantity),
                    client
                );
            }
        }

        await waslModel.deleteWasl(waslId, client);

        await client.query("COMMIT");
        transactionStarted = false;

        res.status(200).json({
            message: "Wasl deleted successfully.",
            wasl: wasl
        });
    } catch (error) {
        if (transactionStarted) {
            await client.query("ROLLBACK");
        }

        console.error("Error deleting wasl:", error.message);

        if (error.status) {
            return res.status(error.status).json({
                message: error.message,
                code: error.code
            });
        }

        res.status(500).json({
            message: "Failed to delete wasl."
        });
    } finally {
        client.release();
    }
};

const getWaslSummary = async (req, res) => {
    try {
        const summary = await waslModel.getWaslSummary();

        res.status(200).json(summary);
    } catch (error) {
        console.error("Error fetching wasl summary:", error.message);

        res.status(500).json({
            message: "Failed to fetch wasl summary."
        });
    }
};

const getTodayWasls = async (req, res) => {
    try {
        const summary = await waslModel.getTodayWasls();

        res.status(200).json(summary);
    } catch (error) {
        console.error("Error fetching today's wasls:", error.message);

        res.status(500).json({
            message: "Failed to fetch today's wasls."
        });
    }
};

const getWaslsByDate = async (req, res) => {
    try {
        const wasls = await waslModel.getWaslsByDate();

        res.status(200).json(wasls);
    } catch (error) {
        console.error("Error fetching wasls by date:", error.message);

        res.status(500).json({
            message: "Failed to fetch wasls by date."
        });
    }
};

const getTopSellingProducts = async (req, res) => {
    try {
        const products = await waslItemModel.getTopSellingProducts();

        res.status(200).json(products);
    } catch (error) {
        console.error("Error fetching top-selling products:", error.message);

        res.status(500).json({
            message: "Failed to fetch top-selling products."
        });
    }
};

module.exports = {
    createWasl,
    getWasls,
    getWaslById,
    deleteWasl,
    getWaslSummary,
    getTodayWasls,
    getWaslsByDate,
    getTopSellingProducts
};
