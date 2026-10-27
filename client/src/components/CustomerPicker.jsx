import { useEffect, useState } from "react";
import { API_URL } from "../config";
import { formatMoney, normalizeText } from "../utils/format";
import CustomerDrawer from "./CustomerDrawer";
import Icon from "./Icon";

// Choose the customer of a credit sale (or add a new one on the spot)
function CustomerPicker({ value, onChange, disabled }) {
    const [customers, setCustomers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState("");
    const [drawerOpen, setDrawerOpen] = useState(false);

    useEffect(() => {
        fetch(`${API_URL}/customers`)
            .then((response) => response.json())
            .then((data) => {
                setCustomers(Array.isArray(data) ? data : []);
            })
            .catch((error) => {
                console.error("Error fetching customers:", error);
            })
            .finally(() => {
                setLoading(false);
            });
    }, []);

    const handleSaved = (customer) => {
        setCustomers((currentCustomers) => [...currentCustomers, customer]);
        setDrawerOpen(false);
        onChange(customer);
    };

    if (value) {
        return (
            <div className="flex items-center justify-between gap-3 rounded-xl border border-brand bg-brand-soft px-4 py-3">
                <div className="min-w-0">
                    <p className="truncate font-semibold text-ink">
                        {value.name}
                    </p>

                    <p className="text-sm text-muted">
                        قەرزی ئێستا: {formatMoney(value.balance)}
                    </p>
                </div>

                <button
                    onClick={() => onChange(null)}
                    disabled={disabled}
                    className="shrink-0 rounded-lg px-3 py-1.5 text-sm font-medium text-brand hover:bg-surface disabled:opacity-50"
                >
                    گۆڕین
                </button>
            </div>
        );
    }

    const search = normalizeText(searchTerm);

    const matches = customers
        .filter(
            (customer) =>
                normalizeText(`${customer.name} ${customer.phone || ""}`).includes(
                    search
                )
        )
        .slice(0, 5);

    return (
        <div>
            <div className="relative">
                <Icon
                    name="search"
                    className="pointer-events-none absolute start-3 top-1/2 size-4.5 -translate-y-1/2 text-muted"
                />

                <input
                    type="text"
                    value={searchTerm}
                    onChange={(event) => setSearchTerm(event.target.value)}
                    disabled={disabled}
                    aria-label="گەڕان بۆ کڕیار"
                    placeholder="ناو یان ژمارەی کڕیار..."
                    className="w-full rounded-xl border border-line bg-surface-2 py-2.5 pe-3 ps-10 text-ink"
                />
            </div>

            <ul className="mt-2 divide-y divide-line overflow-hidden rounded-xl border border-line bg-surface">
                {loading ? (
                    <li className="px-4 py-3 text-sm text-muted">
                        بارکردن...
                    </li>
                ) : matches.length === 0 ? (
                    <li className="px-4 py-3 text-sm text-muted">
                        {customers.length === 0
                            ? "هێشتا هیچ کڕیارێک نییە."
                            : "هیچ کڕیارێک نەدۆزرایەوە."}
                    </li>
                ) : (
                    matches.map((customer) => (
                        <li key={customer.customer_id}>
                            <button
                                onClick={() => onChange(customer)}
                                disabled={disabled}
                                className="flex w-full items-center justify-between gap-3 px-4 py-2.5 text-start hover:bg-brand-soft"
                            >
                                <span className="min-w-0">
                                    <span className="block truncate font-medium text-ink">
                                        {customer.name}
                                    </span>

                                    {customer.phone && (
                                        <span
                                            dir="ltr"
                                            className="block text-start text-xs text-muted"
                                        >
                                            {customer.phone}
                                        </span>
                                    )}
                                </span>

                                <span
                                    className={`shrink-0 text-sm font-semibold ${
                                        customer.balance > 0
                                            ? "text-danger"
                                            : "text-muted"
                                    }`}
                                >
                                    {formatMoney(customer.balance)}
                                </span>
                            </button>
                        </li>
                    ))
                )}
            </ul>

            <button
                onClick={() => setDrawerOpen(true)}
                disabled={disabled}
                className="mt-2 flex items-center gap-2 text-sm font-medium text-brand hover:underline"
            >
                <Icon name="plus" className="size-4" />
                کڕیاری نوێ
            </button>

            {drawerOpen && (
                <CustomerDrawer
                    customer={null}
                    onClose={() => setDrawerOpen(false)}
                    onSaved={handleSaved}
                />
            )}
        </div>
    );
}

export default CustomerPicker;
