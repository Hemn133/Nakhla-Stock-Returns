import { formatMoney, numberToInput } from "../utils/format";
import { getPrice } from "../utils/pricing";
import Icon from "./Icon";

// One line of the cart: name, quantity buttons and the line total
function CartItem({
    item,
    disabled,
    onIncrease,
    onDecrease,
    onRemove,
    onQuantityBlur
}) {
    const unitPrice = getPrice(item);

    const handleKeyDown = (event) => {
        if (event.key === "Enter") {
            event.target.blur();
        }
    };

    return (
        <li className="py-3.5">
            <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                    <p className="font-semibold text-ink">{item.name}</p>

                    <p className="text-sm text-muted">
                        {item.unit_name ? `${item.unit_name} · ` : ""}
                        {formatMoney(unitPrice)}
                    </p>
                </div>

                <button
                    onClick={() => onRemove(item.key)}
                    disabled={disabled}
                    aria-label="لابردنی کاڵا"
                    className="grid size-9 shrink-0 place-items-center rounded-lg text-muted hover:bg-danger-soft hover:text-danger disabled:opacity-50"
                >
                    <Icon name="trash" className="size-4.5" />
                </button>
            </div>

            <div className="mt-2.5 flex items-center justify-between gap-3">
                <div className="flex items-center rounded-full border border-line bg-surface-2">
                    <button
                        onClick={() => onDecrease(item.key)}
                        disabled={disabled}
                        aria-label="کەمکردنەوە"
                        className="grid size-9 place-items-center rounded-full text-ink hover:bg-brand-soft disabled:opacity-50"
                    >
                        <Icon name="minus" className="size-4" />
                    </button>

                    <input
                        key={item.quantity}
                        type="text"
                        inputMode="decimal"
                        dir="ltr"
                        defaultValue={numberToInput(item.quantity)}
                        onBlur={(event) => onQuantityBlur(item, event)}
                        onKeyDown={handleKeyDown}
                        disabled={disabled}
                        aria-label="بڕ"
                        className="w-12 bg-transparent text-center font-bold text-ink"
                    />

                    <button
                        onClick={() => onIncrease(item.key)}
                        disabled={disabled}
                        aria-label="زیادکردن"
                        className="grid size-9 place-items-center rounded-full text-ink hover:bg-brand-soft disabled:opacity-50"
                    >
                        <Icon name="plus" className="size-4" />
                    </button>
                </div>

                <p className="font-display text-lg font-bold text-ink">
                    {formatMoney(Math.round(unitPrice * 100 * item.quantity) / 100)}
                </p>
            </div>
        </li>
    );
}

export default CartItem;
