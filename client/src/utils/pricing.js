// All prices are USD. Money is calculated in whole cents, like the server does,
// so the cart shows exactly the amounts that will be saved.

export const roundMoney = (amount) => Math.round(amount * 100) / 100;

// Price of a unit (or cart item)
export const getPrice = (item) => Number(item.price_usd) || 0;

// Total of one cart line, in cents
const getLineCents = (item) =>
    Math.round(Math.round(getPrice(item) * 100) * item.quantity);

export const calculateTotals = (cart, discount) => {
    const subtotalCents = cart.reduce(
        (sum, item) => sum + getLineCents(item),
        0
    );

    const discountCents = Math.round(discount * 100);
    const totalCents = Math.max(0, subtotalCents - discountCents);

    return {
        subtotal: subtotalCents / 100,
        discount: discountCents / 100,
        total: totalCents / 100
    };
};
