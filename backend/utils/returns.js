// The money rules of a product return, kept in one place with no database calls
// so they can be tested on their own. Everything is whole cents / thousandths.
//
//   A return of a CASH wasl      -> the whole amount is refunded in cash.
//   A return of a CREDIT wasl    -> the amount first lowers the customer's debt
//                                   (never below 0); only what is left over,
//                                   because the customer already paid it, is
//                                   refunded in cash.
//   A discount on the wasl is shared in proportion, so a customer is never
//   refunded more than was really paid for the goods.

const { parseAmount, toCents } = require("./numbers");

class ReturnError extends Error {
    constructor(status, message, code) {
        super(message);
        this.status = status;
        this.code = code;
    }
}

const toThousandths = (quantity) => Math.round(Number(quantity) * 1000);

// Value (cents) of the part of a line that was returned.
// When the whole line is returned it is exactly the line subtotal, so the
// amounts of several partial returns always add up to the original line.
const getLineReturnedCents = (item, returnedThousandths) => {
    if (returnedThousandths <= 0) {
        return 0;
    }

    if (returnedThousandths >= toThousandths(item.quantity)) {
        return toCents(item.subtotal);
    }

    return Math.round(
        (toCents(item.unit_price) * returnedThousandths) / 1000
    );
};

// "none" | "partial" | "full", worked out from the real returned quantities
const getReturnStatus = (items) => {
    const anyReturned = items.some(
        (item) => toThousandths(item.returned_quantity) > 0
    );

    if (!anyReturned) {
        return "none";
    }

    const allReturned = items.every(
        (item) =>
            toThousandths(item.returned_quantity) >=
            toThousandths(item.quantity)
    );

    return allReturned ? "full" : "partial";
};

// wasl     : { sale_type, subtotal, total }
// items    : lines of the wasl { wasl_item_id, quantity, returned_quantity, unit_price, subtotal }
// requested: [{ wasl_item_id, quantity }]
// previous : { goodsCents, netCents } of the earlier returns of this wasl
// balanceCents: what the customer owes now (credit wasls only)
const calculateReturn = ({
    wasl,
    items,
    requested,
    previous,
    balanceCents
}) => {
    if (!Array.isArray(requested) || requested.length === 0) {
        throw new ReturnError(
            400,
            "Choose at least one product to return.",
            "NOTHING_SELECTED"
        );
    }

    if (requested.length > 200) {
        throw new ReturnError(400, "Too many products.", "INVALID");
    }

    const seen = new Set();
    const lines = [];

    for (const request of requested) {
        const waslItemId = Number(request && request.wasl_item_id);

        if (!Number.isInteger(waslItemId) || waslItemId <= 0) {
            throw new ReturnError(400, "Invalid product.", "INVALID");
        }

        if (seen.has(waslItemId)) {
            throw new ReturnError(
                400,
                "A product is listed twice.",
                "INVALID"
            );
        }

        seen.add(waslItemId);

        const item = items.find((line) => line.wasl_item_id === waslItemId);

        if (!item) {
            throw new ReturnError(
                404,
                "This product is not on this wasl.",
                "NOT_ON_WASL"
            );
        }

        const quantity = parseAmount(request.quantity);

        if (
            quantity === null ||
            Math.abs(quantity * 1000 - Math.round(quantity * 1000)) > 1e-6 ||
            Math.round(quantity * 1000) < 1
        ) {
            throw new ReturnError(
                400,
                "Return quantity must be greater than zero (at most 3 decimals).",
                "INVALID"
            );
        }

        const quantityThousandths = Math.round(quantity * 1000);
        const returnedBefore = toThousandths(item.returned_quantity);

        const eligible = toThousandths(item.quantity) - returnedBefore;

        if (quantityThousandths > eligible) {
            throw new ReturnError(
                409,
                `Cannot return more than what is left on "${item.product_name}" (${eligible / 1000}).`,
                "EXCEEDS_ELIGIBLE"
            );
        }

        const grossCents =
            getLineReturnedCents(item, returnedBefore + quantityThousandths) -
            getLineReturnedCents(item, returnedBefore);

        lines.push({
            wasl_item_id: waslItemId,
            quantity: quantityThousandths / 1000,
            unit_price: Number(item.unit_price),
            grossCents: grossCents,
            item: item
        });
    }

    const goodsCents = lines.reduce((sum, line) => sum + line.grossCents, 0);

    // Share the wasl discount in proportion. The running total is rounded, not
    // every return, so all returns together refund exactly what was paid.
    const subtotalCents = toCents(wasl.subtotal);
    const totalCents = toCents(wasl.total);
    const goodsReturnedAfter = previous.goodsCents + goodsCents;

    let netReturnedAfter = 0;

    if (subtotalCents > 0) {
        netReturnedAfter =
            goodsReturnedAfter >= subtotalCents
                ? totalCents
                : Math.round((goodsReturnedAfter * totalCents) / subtotalCents);
    }

    const netCents = Math.max(0, netReturnedAfter - previous.netCents);

    // Credit: lower the debt first, refund only what the debt cannot take
    let debtReductionCents = 0;

    if (wasl.sale_type === "credit") {
        debtReductionCents = Math.min(netCents, Math.max(balanceCents, 0));
    }

    return {
        lines: lines,
        goodsCents: goodsCents,
        netCents: netCents,
        debtReductionCents: debtReductionCents,
        refundCents: netCents - debtReductionCents
    };
};

module.exports = {
    ReturnError,
    toThousandths,
    getLineReturnedCents,
    getReturnStatus,
    calculateReturn
};
