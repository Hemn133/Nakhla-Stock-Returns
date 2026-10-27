// Product returns (گەڕاندنەوەی کاڵا) on the screen.
// The server always calculates the real amounts again. This is the same rule,
// used to show the effect of a return BEFORE it is confirmed.

// The exact labels
export const RETURNED_LABEL = "گەڕاوەتەوە";
export const FULL_RETURN_LABEL = "وەسڵەکە بە کاملی گەڕاوەتەوە";
export const PARTIAL_RETURN_LABEL = "بەشێکی گەڕاوەتەوە";

const toCents = (amount) => Math.round(Number(amount) * 100);

const toThousandths = (quantity) => Math.round(Number(quantity) * 1000);

// Value (cents) of the part of a line that was returned.
// A whole line is exactly its subtotal, so partial returns add up to it.
const getLineReturnedCents = (item, returnedThousandths) => {
    if (returnedThousandths <= 0) {
        return 0;
    }

    if (returnedThousandths >= toThousandths(item.quantity)) {
        return toCents(item.subtotal);
    }

    return Math.round((toCents(item.unit_price) * returnedThousandths) / 1000);
};

// "none" | "partial" | "full", worked out from the real returned quantities
export const getReturnStatus = (items) => {
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

// What can still be returned from a line
export const getEligibleQuantity = (item) =>
    (toThousandths(item.quantity) - toThousandths(item.returned_quantity)) /
    1000;

// Sums of the earlier returns of a wasl
export const sumReturns = (returns) =>
    (returns || []).reduce(
        (sum, waslReturn) => ({
            goodsCents: sum.goodsCents + toCents(waslReturn.goods_amount),
            netCents: sum.netCents + toCents(waslReturn.net_amount),
            debtCents: sum.debtCents + toCents(waslReturn.debt_reduction),
            refundCents: sum.refundCents + toCents(waslReturn.refund_amount)
        }),
        { goodsCents: 0, netCents: 0, debtCents: 0, refundCents: 0 }
    );

// quantities: { [wasl_item_id]: number }  (only what the user wants to return)
// balance   : what the customer owes now (credit wasls only)
export const calculateReturnPreview = ({
    wasl,
    items,
    returns,
    quantities,
    balance
}) => {
    const previous = sumReturns(returns);

    let goodsCents = 0;

    items.forEach((item) => {
        const quantity = quantities[item.wasl_item_id];

        if (!quantity || quantity <= 0) {
            return;
        }

        const before = toThousandths(item.returned_quantity);
        const after = before + toThousandths(quantity);

        goodsCents +=
            getLineReturnedCents(item, after) -
            getLineReturnedCents(item, before);
    });

    // The wasl discount is shared in proportion (same as the server)
    const subtotalCents = toCents(wasl.subtotal);
    const totalCents = toCents(wasl.total);
    const goodsAfter = previous.goodsCents + goodsCents;

    let netAfter = 0;

    if (subtotalCents > 0) {
        netAfter =
            goodsAfter >= subtotalCents
                ? totalCents
                : Math.round((goodsAfter * totalCents) / subtotalCents);
    }

    const netCents = Math.max(0, netAfter - previous.netCents);

    // Credit: the debt goes down first, only the excess is refunded in cash
    let debtCents = 0;

    if (wasl.sale_type === "credit") {
        debtCents = Math.min(netCents, Math.max(toCents(balance || 0), 0));
    }

    return {
        goods: goodsCents / 100,
        net: netCents / 100,
        debtReduction: debtCents / 100,
        refund: (netCents - debtCents) / 100,
        newBalance:
            wasl.sale_type === "credit"
                ? (toCents(balance || 0) - debtCents) / 100
                : null
    };
};

// A request id for one return, so a double click can never apply it twice.
// (crypto.randomUUID needs https, so there is a fallback for http on the network)
export const createRequestId = () =>
    typeof crypto !== "undefined" && crypto.randomUUID
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2)}-${Math.random()
              .toString(36)
              .slice(2)}`;
