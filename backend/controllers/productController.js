const pool = require("../config/db");
const productModel = require("../models/productModel");
const productUnitModel = require("../models/productUnitModel");
const { hasMaxTwoDecimals, parseAmount } = require("../utils/numbers");

// Check the request body of create / update product.
// Returns { error } or the cleaned { name, units }.
const validateProductBody = (body) => {
    const { name, units } = body;

    if (typeof name !== "string" || !name.trim()) {
        return { error: "Product name is required." };
    }

    if (name.trim().length > 150) {
        return { error: "Product name is too long." };
    }

    if (!Array.isArray(units) || units.length === 0) {
        return { error: "Product must have at least one unit." };
    }

    if (units.length > 20) {
        return { error: "A product can have at most 20 units." };
    }

    const cleanUnits = [];

    for (const unit of units) {
        const unitName =
            typeof unit?.unit_name === "string" ? unit.unit_name.trim() : "";

        if (!unitName) {
            return { error: "Every unit needs a name." };
        }

        if (unitName.length > 50) {
            return { error: "Unit name is too long." };
        }

        // All prices are USD
        const priceUsd = parseAmount(unit.price_usd);

        if (
            priceUsd === null ||
            priceUsd < 0 ||
            priceUsd > 10000000 ||
            !hasMaxTwoDecimals(priceUsd)
        ) {
            return {
                error: `Unit "${unitName}" needs a price in USD (zero or more, at most 2 decimals).`
            };
        }

        // Stock is optional. Empty = stock is not tracked for this unit.
        let stockQuantity = null;

        if (
            unit.stock_quantity !== undefined &&
            unit.stock_quantity !== null &&
            unit.stock_quantity !== ""
        ) {
            stockQuantity = parseAmount(unit.stock_quantity);

            if (
                stockQuantity === null ||
                stockQuantity < 0 ||
                stockQuantity > 100000000 ||
                Math.abs(stockQuantity * 1000 - Math.round(stockQuantity * 1000)) > 1e-6
            ) {
                return {
                    error: `Stock of unit "${unitName}" must be zero or more (at most 3 decimals).`
                };
            }
        }

        // An existing unit keeps its id, so its stock and sales stay linked
        const unitId = Number(unit.unit_id);

        cleanUnits.push({
            unitId: Number.isInteger(unitId) && unitId > 0 ? unitId : null,
            unitName,
            priceUsd,
            stockQuantity
        });
    }

    return { name: name.trim(), units: cleanUnits };
};

const getProducts = async (req, res) => {
    try {
        const products = await productModel.getAllProducts();

        res.status(200).json(products);
    } catch (error) {
        console.error("Error fetching products:", error.message);

        res.status(500).json({
            message: "Failed to fetch products."
        });
    }
};

const getProductById = async (req, res) => {
    try {
        const productId = Number(req.params.id);

        if (!Number.isInteger(productId) || productId <= 0) {
            return res.status(400).json({
                message: "Invalid product ID."
            });
        }

        const product = await productModel.getProductById(productId);

        if (!product) {
            return res.status(404).json({
                message: "Product not found."
            });
        }

        res.status(200).json(product);
    } catch (error) {
        console.error("Error fetching product:", error.message);

        res.status(500).json({
            message: "Failed to fetch product."
        });
    }
};

const createProduct = async (req, res) => {
    const validated = validateProductBody(req.body);

    if (validated.error) {
        return res.status(400).json({
            message: validated.error
        });
    }

    const client = await pool.connect();
    let transactionStarted = false;

    try {
        await client.query("BEGIN");
        transactionStarted = true;

        const product = await productModel.createProduct(
            validated.name,
            client
        );

        for (let i = 0; i < validated.units.length; i++) {
            const unit = validated.units[i];

            await productUnitModel.createProductUnit(
                product.product_id,
                unit.unitName,
                unit.priceUsd,
                unit.stockQuantity,
                i,
                client
            );
        }

        await client.query("COMMIT");
        transactionStarted = false;

        const fullProduct = await productModel.getProductById(
            product.product_id
        );

        res.status(201).json(fullProduct);
    } catch (error) {
        if (transactionStarted) {
            await client.query("ROLLBACK");
        }

        console.error("Error creating product:", error.message);

        res.status(500).json({
            message: "Failed to create product."
        });
    } finally {
        client.release();
    }
};

const updateProduct = async (req, res) => {
    const productId = Number(req.params.id);

    if (!Number.isInteger(productId) || productId <= 0) {
        return res.status(400).json({
            message: "Invalid product ID."
        });
    }

    const validated = validateProductBody(req.body);

    if (validated.error) {
        return res.status(400).json({
            message: validated.error
        });
    }

    const client = await pool.connect();
    let transactionStarted = false;

    try {
        await client.query("BEGIN");
        transactionStarted = true;

        const product = await productModel.updateProduct(
            productId,
            validated.name,
            client
        );

        if (!product) {
            await client.query("ROLLBACK");
            transactionStarted = false;

            return res.status(404).json({
                message: "Product not found."
            });
        }

        // Units are updated in place (not deleted and created again), so a unit
        // keeps its id, its stock and the link to the wasls sold from it.
        const existingUnitIds = await productUnitModel.getUnitIdsByProductId(
            productId,
            client
        );

        const keptUnitIds = [];

        for (let i = 0; i < validated.units.length; i++) {
            const unit = validated.units[i];

            const isExistingUnit =
                unit.unitId !== null &&
                existingUnitIds.includes(unit.unitId) &&
                !keptUnitIds.includes(unit.unitId);

            if (isExistingUnit) {
                await productUnitModel.updateProductUnit(
                    unit.unitId,
                    productId,
                    unit.unitName,
                    unit.priceUsd,
                    unit.stockQuantity,
                    i,
                    client
                );

                keptUnitIds.push(unit.unitId);
            } else {
                const created = await productUnitModel.createProductUnit(
                    productId,
                    unit.unitName,
                    unit.priceUsd,
                    unit.stockQuantity,
                    i,
                    client
                );

                keptUnitIds.push(created.unit_id);
            }
        }

        // Units that were removed in the form
        await productUnitModel.deleteUnitsByIds(
            existingUnitIds.filter((unitId) => !keptUnitIds.includes(unitId)),
            client
        );

        await client.query("COMMIT");
        transactionStarted = false;

        const fullProduct = await productModel.getProductById(productId);

        res.status(200).json(fullProduct);
    } catch (error) {
        if (transactionStarted) {
            await client.query("ROLLBACK");
        }

        console.error("Error updating product:", error.message);

        res.status(500).json({
            message: "Failed to update product."
        });
    } finally {
        client.release();
    }
};

const deleteProduct = async (req, res) => {
    try {
        const productId = Number(req.params.id);

        if (!Number.isInteger(productId) || productId <= 0) {
            return res.status(400).json({
                message: "Invalid product ID."
            });
        }

        // Old wasls keep their own copy of the product name and price,
        // so a product can always be deleted safely.
        const product = await productModel.deleteProduct(productId);

        if (!product) {
            return res.status(404).json({
                message: "Product not found."
            });
        }

        res.status(200).json({
            message: "Product deleted successfully.",
            product: product
        });
    } catch (error) {
        console.error("Error deleting product:", error.message);

        res.status(500).json({
            message: "Failed to delete product."
        });
    }
};

module.exports = {
    getProducts,
    getProductById,
    createProduct,
    updateProduct,
    deleteProduct
};
