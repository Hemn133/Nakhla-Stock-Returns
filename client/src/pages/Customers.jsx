import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { API_URL } from "../config";
import useUi from "../hooks/useUi";
import CustomerDrawer from "../components/CustomerDrawer";
import EmptyState from "../components/EmptyState";
import Icon from "../components/Icon";
import PageHeader from "../components/PageHeader";
import Segmented from "../components/Segmented";
import { formatMoney, formatNumber, normalizeText } from "../utils/format";

const filterOptions = [
    { value: "all", label: "هەموو" },
    { value: "debtors", label: "قەرزدارەکان" }
];

function Customers() {
    const navigate = useNavigate();
    const { toast } = useUi();

    const [customers, setCustomers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState("");
    const [filter, setFilter] = useState("all");
    const [drawerOpen, setDrawerOpen] = useState(false);

    useEffect(() => {
        fetch(`${API_URL}/customers`)
            .then((response) => response.json())
            .then((data) => {
                setCustomers(Array.isArray(data) ? data : []);
            })
            .catch((error) => {
                console.error("Error fetching customers:", error);

                toast("نەتوانرا کڕیاران باربکرێن.", "error");
            })
            .finally(() => {
                setLoading(false);
            });
    }, [toast]);

    const handleSaved = (customer) => {
        setDrawerOpen(false);

        // go straight to the profile of the new customer
        navigate(`/customers/${customer.customer_id}`);
    };

    const debtors = customers.filter((customer) => customer.balance > 0);

    const totalOutstanding =
        Math.round(
            debtors.reduce((sum, customer) => sum + customer.balance * 100, 0)
        ) / 100;

    const search = normalizeText(searchTerm);

    const filteredCustomers = customers.filter(
        (customer) =>
            (filter === "all" || customer.balance > 0) &&
            normalizeText(`${customer.name} ${customer.phone || ""}`).includes(
                search
            )
    );

    return (
        <div>
            <PageHeader
                title="کڕیاران"
                subtitle="کڕیارانی قەرز، پارە وەرگرتن و کەشفی حساب."
            >
                <button
                    onClick={() => setDrawerOpen(true)}
                    className="flex items-center gap-2 rounded-xl bg-brand px-5 py-3 font-bold text-brand-ink hover:opacity-90"
                >
                    <Icon name="plus" className="size-5" />
                    کڕیاری نوێ
                </button>
            </PageHeader>

            <dl className="grid grid-cols-1 divide-y divide-line rounded-2xl border border-line bg-surface sm:grid-cols-3 sm:divide-y-0">
                <div className="px-6 py-4">
                    <dt className="text-sm text-muted">ژمارەی کڕیاران</dt>

                    <dd className="mt-0.5 font-display text-2xl font-bold text-ink">
                        {loading ? "…" : formatNumber(customers.length)}
                    </dd>
                </div>

                <div className="px-6 py-4 sm:border-s sm:border-line">
                    <dt className="text-sm text-muted">قەرزدار</dt>

                    <dd className="mt-0.5 font-display text-2xl font-bold text-ink">
                        {loading ? "…" : formatNumber(debtors.length)}
                    </dd>
                </div>

                <div className="px-6 py-4 sm:border-s sm:border-line">
                    <dt className="text-sm text-muted">کۆی قەرزی ماوە</dt>

                    <dd className="mt-0.5 font-display text-2xl font-bold text-danger">
                        {loading ? "…" : formatMoney(totalOutstanding)}
                    </dd>
                </div>
            </dl>

            <div className="mt-6 flex flex-wrap items-center gap-3">
                <div className="relative min-w-56 flex-1">
                    <Icon
                        name="search"
                        className="pointer-events-none absolute start-4 top-1/2 size-5 -translate-y-1/2 text-muted"
                    />

                    <input
                        type="text"
                        value={searchTerm}
                        onChange={(event) => setSearchTerm(event.target.value)}
                        aria-label="گەڕان بۆ کڕیار"
                        placeholder="ناو یان ژمارەی مۆبایل..."
                        className="w-full rounded-2xl border border-line bg-surface py-3.5 pe-4 ps-12 text-ink"
                    />
                </div>

                <Segmented
                    options={filterOptions}
                    value={filter}
                    onChange={setFilter}
                    label="پیشاندان"
                />
            </div>

            <div className="mt-5 overflow-hidden rounded-2xl border border-line bg-surface">
                {loading ? (
                    <ul className="divide-y divide-line">
                        {[0, 1, 2].map((row) => (
                            <li key={row} className="p-5">
                                <div className="h-6 w-44 animate-pulse rounded-lg bg-surface-2" />
                            </li>
                        ))}
                    </ul>
                ) : customers.length === 0 ? (
                    <EmptyState
                        title="هێشتا هیچ کڕیارێک زیاد نەکراوە"
                        description="کڕیارێک زیادبکە بۆ ئەوەی بتوانیت بە قەرز بیفرۆشیت و پارە وەربگریت."
                    >
                        <button
                            onClick={() => setDrawerOpen(true)}
                            className="rounded-xl bg-brand px-6 py-3 font-bold text-brand-ink hover:opacity-90"
                        >
                            کڕیاری نوێ
                        </button>
                    </EmptyState>
                ) : filteredCustomers.length === 0 ? (
                    <EmptyState
                        title="هیچ کڕیارێک نەدۆزرایەوە"
                        description="گەڕان یان پیشاندانەکە بگۆڕە."
                    />
                ) : (
                    <ul className="divide-y divide-line">
                        {filteredCustomers.map((customer) => (
                            <li key={customer.customer_id}>
                                <button
                                    onClick={() =>
                                        navigate(
                                            `/customers/${customer.customer_id}`
                                        )
                                    }
                                    className="flex w-full items-center gap-4 p-4 text-start hover:bg-surface-2"
                                >
                                    <span className="grid size-11 shrink-0 place-items-center rounded-full bg-brand-soft font-display text-lg font-extrabold text-brand">
                                        {customer.name.trim().charAt(0)}
                                    </span>

                                    <span className="min-w-0 flex-1">
                                        <span className="block truncate font-semibold text-ink">
                                            {customer.name}
                                        </span>

                                        <span
                                            dir="ltr"
                                            className="block text-start text-sm text-muted"
                                        >
                                            {customer.phone || "—"}
                                        </span>
                                    </span>

                                    <span className="text-end">
                                        <span
                                            className={`block font-display text-lg font-bold ${
                                                customer.balance > 0
                                                    ? "text-danger"
                                                    : "text-muted"
                                            }`}
                                        >
                                            {formatMoney(customer.balance)}
                                        </span>

                                        <span className="block text-xs text-muted">
                                            {customer.balance > 0
                                                ? "قەرزی ماوە"
                                                : "قەرزی نییە"}
                                        </span>
                                    </span>

                                    <Icon
                                        name="chevron"
                                        className="size-5 shrink-0 text-muted"
                                    />
                                </button>
                            </li>
                        ))}
                    </ul>
                )}
            </div>

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

export default Customers;
