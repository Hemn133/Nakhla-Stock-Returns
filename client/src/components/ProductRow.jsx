import { formatMoney, formatNumber } from "../utils/format";

// One product of the POS list: its name and a button for every unit
function ProductRow({ product, cartQuantities, disabled, onAdd }) {
    return (
        <li className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
            <p className="font-display text-lg font-bold text-ink">
                {product.name}
            </p>

            <div className="flex flex-wrap gap-2.5">
                {product.units.map((unit) => {
                    const quantityInCart =
                        cartQuantities[`unit-${unit.unit_id}`];

                    // stock_quantity null = stock is not tracked for this unit
                    const isTracked = unit.stock_quantity !== null;
                    const stock = isTracked ? Number(unit.stock_quantity) : null;
                    const isSoldOut = isTracked && stock <= 0;

                    return (
                        <button
                            key={unit.unit_id}
                            onClick={() => onAdd(product, unit)}
                            disabled={disabled || isSoldOut}
                            className="relative min-w-32 rounded-xl border border-line bg-surface-2 px-4 py-2.5 text-start transition hover:border-brand hover:bg-brand-soft active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-60"
                        >
                            <span className="block text-sm text-muted">
                                {unit.unit_name}
                            </span>

                            <span className="block font-bold text-ink">
                                {formatMoney(unit.price_usd)}
                            </span>

                            {isTracked && (
                                <span
                                    className={`block text-xs ${
                                        isSoldOut || stock <= 3
                                            ? "font-bold text-danger"
                                            : "text-muted"
                                    }`}
                                >
                                    {isSoldOut
                                        ? "ستۆک تەواو بووە"
                                        : `ستۆک: ${formatNumber(stock, 3)}`}
                                </span>
                            )}

                            {quantityInCart && (
                                <span
                                    key={quantityInCart}
                                    className="absolute -end-2 -top-2 grid min-w-6 animate-pop place-items-center rounded-full bg-gold px-1.5 py-0.5 text-xs font-bold text-gold-ink"
                                >
                                    {formatNumber(quantityInCart, 3)}
                                </span>
                            )}
                        </button>
                    );
                })}
            </div>
        </li>
    );
}

export default ProductRow;
