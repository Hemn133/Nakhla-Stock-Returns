import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { API_URL } from "../config";
import useUi from "../hooks/useUi";
import CustomerDrawer from "../components/CustomerDrawer";
import EmptyState from "../components/EmptyState";
import Icon from "../components/Icon";
import PaymentModal from "../components/PaymentModal";
import StatementDialog from "../components/StatementDialog";
import StatementModal from "../components/StatementModal";
import WaslViewer from "../components/WaslViewer";
import {
    formatDate,
    formatDay,
    formatMoney,
    formatNumber,
    localizeDigits
} from "../utils/format";
import {
    FULL_RETURN_LABEL,
    PARTIAL_RETURN_LABEL,
    RETURNED_LABEL
} from "../utils/returns";

function CustomerProfile() {
    const { id } = useParams();
    const navigate = useNavigate();
    const { toast, confirm } = useUi();

    const [customer, setCustomer] = useState(null);
    const [sales, setSales] = useState([]);
    const [payments, setPayments] = useState([]);
    const [returns, setReturns] = useState([]);
    const [loading, setLoading] = useState(true);
    const [notFound, setNotFound] = useState(false);

    // Windows
    const [paymentOpen, setPaymentOpen] = useState(false);
    const [editOpen, setEditOpen] = useState(false);
    const [statementDialogOpen, setStatementDialogOpen] = useState(false);
    const [statement, setStatement] = useState(null);
    const [selectedWaslId, setSelectedWaslId] = useState(null);

    const fetchAll = useCallback(async () => {
        try {
            const [
                customerResponse,
                salesResponse,
                paymentsResponse,
                returnsResponse
            ] = await Promise.all([
                fetch(`${API_URL}/customers/${id}`),
                fetch(`${API_URL}/customers/${id}/sales`),
                fetch(`${API_URL}/customers/${id}/payments`),
                fetch(`${API_URL}/customers/${id}/returns`)
            ]);

            if (customerResponse.status === 404) {
                setNotFound(true);
                return;
            }

            if (
                !customerResponse.ok ||
                !salesResponse.ok ||
                !paymentsResponse.ok ||
                !returnsResponse.ok
            ) {
                throw new Error("Failed to load the customer.");
            }

            setCustomer(await customerResponse.json());
            setSales(await salesResponse.json());
            setPayments(await paymentsResponse.json());
            setReturns(await returnsResponse.json());
        } catch (error) {
            console.error("Error fetching customer:", error);

            toast("نەتوانرا زانیاری کڕیار باربکرێت.", "error");
        } finally {
            setLoading(false);
        }
    }, [id, toast]);

    useEffect(() => {
        fetchAll();
    }, [fetchAll]);

    const handlePaymentSaved = async () => {
        setPaymentOpen(false);

        await fetchAll();
    };

    const handleEditSaved = async () => {
        setEditOpen(false);

        await fetchAll();
    };

    const handleDeletePayment = async (payment) => {
        const confirmed = await confirm(
            `پارەی ${formatMoney(payment.amount)} دەسڕدرێتەوە و قەرزی کڕیار زیاد دەبێتەوە.`,
            {
                title: "ئەم پارە وەرگرتنە بسڕدرێتەوە؟",
                confirmLabel: "سڕینەوە",
                danger: true
            }
        );

        if (!confirmed) {
            return;
        }

        try {
            const response = await fetch(
                `${API_URL}/customers/${id}/payments/${payment.payment_id}`,
                { method: "DELETE" }
            );

            if (!response.ok) {
                toast("نەتوانرا پارە وەرگرتنەکە بسڕدرێتەوە.", "error");
                return;
            }

            toast("پارە وەرگرتنەکە سڕایەوە.", "success");

            await fetchAll();
        } catch (error) {
            console.error("Error deleting payment:", error);

            toast("هەڵەیەک ڕوویدا لە کاتی سڕینەوە.", "error");
        }
    };

    const handleDeleteCustomer = async () => {
        const confirmed = await confirm(
            `"${customer.name}" دەسڕدرێتەوە.`,
            {
                title: "ئەم کڕیارە بسڕدرێتەوە؟",
                confirmLabel: "سڕینەوە",
                danger: true
            }
        );

        if (!confirmed) {
            return;
        }

        try {
            const response = await fetch(`${API_URL}/customers/${id}`, {
                method: "DELETE"
            });

            if (response.status === 409) {
                toast(
                    "ناتوانرێت ئەم کڕیارە بسڕدرێتەوە چونکە فرۆشتنی بە قەرز یان پارە وەرگرتنی هەیە.",
                    "error"
                );
                return;
            }

            if (!response.ok) {
                toast("نەتوانرا کڕیار بسڕدرێتەوە.", "error");
                return;
            }

            toast("کڕیار سڕایەوە.", "success");

            navigate("/customers");
        } catch (error) {
            console.error("Error deleting customer:", error);

            toast("هەڵەیەک ڕوویدا لە کاتی سڕینەوەی کڕیار.", "error");
        }
    };

    const handleStatementCreated = (data) => {
        setStatementDialogOpen(false);
        setStatement(data);
    };

    if (loading) {
        return <p className="py-24 text-center text-muted">بارکردن...</p>;
    }

    if (notFound || !customer) {
        return (
            <div className="rounded-3xl border border-line bg-surface">
                <EmptyState
                    title="ئەم کڕیارە نەدۆزرایەوە"
                    description="ڕەنگە سڕابێتەوە."
                >
                    <Link
                        to="/customers"
                        className="rounded-xl bg-brand px-6 py-3 font-semibold text-brand-ink hover:opacity-90"
                    >
                        گەڕانەوە بۆ کڕیاران
                    </Link>
                </EmptyState>
            </div>
        );
    }

    const hasDebt = Number(customer.balance) > 0;

    return (
        <div>
            <Link
                to="/customers"
                className="mb-4 inline-flex items-center gap-1 text-sm font-medium text-brand hover:underline"
            >
                <Icon name="chevron" className="size-4 -scale-x-100" />
                کڕیاران
            </Link>

            <header className="flex flex-wrap items-start justify-between gap-4">
                <div className="min-w-0">
                    <h1 className="font-display text-3xl font-extrabold text-ink">
                        {customer.name}
                    </h1>

                    <p className="mt-1.5 space-x-3 text-muted rtl:space-x-reverse">
                        {customer.phone && (
                            <span dir="ltr" className="inline-block">
                                {customer.phone}
                            </span>
                        )}

                        {customer.address && <span>{customer.address}</span>}
                    </p>

                    {customer.notes && (
                        <p className="mt-2 max-w-xl text-sm text-muted">
                            {customer.notes}
                        </p>
                    )}
                </div>

                <div className="flex flex-wrap gap-2">
                    <button
                        onClick={() => setPaymentOpen(true)}
                        disabled={!hasDebt}
                        className="flex items-center gap-2 rounded-xl bg-gold px-5 py-3 font-bold text-gold-ink hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                        <Icon name="wallet" className="size-5" />
                        پارە وەرگرتن
                    </button>

                    <button
                        onClick={() => setStatementDialogOpen(true)}
                        className="flex items-center gap-2 rounded-xl bg-brand px-5 py-3 font-bold text-brand-ink hover:opacity-90"
                    >
                        <Icon name="file" className="size-5" />
                        کشف حساب
                    </button>

                    <button
                        onClick={() => setEditOpen(true)}
                        aria-label="دەستکاریکردنی کڕیار"
                        className="grid size-12 place-items-center rounded-xl border border-line text-ink hover:border-brand hover:text-brand"
                    >
                        <Icon name="edit" className="size-5" />
                    </button>

                    <button
                        onClick={handleDeleteCustomer}
                        aria-label="سڕینەوەی کڕیار"
                        className="grid size-12 place-items-center rounded-xl border border-line text-muted hover:border-danger hover:bg-danger-soft hover:text-danger"
                    >
                        <Icon name="trash" className="size-5" />
                    </button>
                </div>
            </header>

            <dl className="mt-6 grid grid-cols-2 divide-y divide-line rounded-2xl border border-line bg-surface lg:grid-cols-4 lg:divide-y-0">
                <div className="px-6 py-4">
                    <dt className="text-sm text-muted">کۆی فرۆشتن بە قەرز</dt>

                    <dd className="mt-0.5 font-display text-2xl font-bold text-ink">
                        {formatMoney(customer.total_credit)}
                    </dd>
                </div>

                <div className="px-6 py-4 lg:border-s lg:border-line">
                    <dt className="text-sm text-muted">کۆی پارەی وەرگیراو</dt>

                    <dd className="mt-0.5 font-display text-2xl font-bold text-brand">
                        {formatMoney(customer.total_paid)}
                    </dd>
                </div>

                <div className="px-6 py-4 lg:border-s lg:border-line">
                    <dt className="text-sm text-muted">
                        گەڕاندنەوە (لە قەرز کەمکراوەتەوە)
                    </dt>

                    <dd className="mt-0.5 font-display text-2xl font-bold text-ink">
                        {formatMoney(customer.total_returned)}
                    </dd>
                </div>

                <div className="px-6 py-4 lg:border-s lg:border-line">
                    <dt className="text-sm text-muted">قەرزی ماوە</dt>

                    <dd
                        className={`mt-0.5 font-display text-2xl font-bold ${
                            hasDebt ? "text-danger" : "text-ink"
                        }`}
                    >
                        {formatMoney(customer.balance)}
                    </dd>
                </div>
            </dl>

            <div className="mt-8 grid gap-8 lg:grid-cols-2">
                {/* CREDIT SALES */}
                <section>
                    <h2 className="mb-4 font-display text-xl font-bold text-ink">
                        فرۆشتنە بە قەرزەکان
                    </h2>

                    <div className="overflow-hidden rounded-2xl border border-line bg-surface">
                        {sales.length === 0 ? (
                            <EmptyState
                                title="هێشتا فرۆشتنی بە قەرز نییە"
                                description="لە بەشی «وەسڵی نوێ»، جۆری فرۆشتن بکە بە «قەرز»."
                            />
                        ) : (
                            <ul className="divide-y divide-line">
                                {sales.map((sale) => (
                                    <li key={sale.wasl_id}>
                                        <button
                                            onClick={() =>
                                                setSelectedWaslId(sale.wasl_id)
                                            }
                                            className="flex w-full items-center gap-4 p-4 text-start hover:bg-surface-2"
                                        >
                                            <span className="grid h-11 min-w-14 place-items-center rounded-xl bg-brand-soft px-2 font-display font-extrabold text-brand">
                                                {localizeDigits(
                                                    String(
                                                        sale.wasl_id
                                                    ).padStart(4, "0")
                                                )}
                                            </span>

                                            <span className="min-w-0 flex-1">
                                                <span className="block text-sm text-muted">
                                                    {formatDate(
                                                        sale.created_at
                                                    )}
                                                </span>

                                                <span className="block text-sm text-muted">
                                                    {formatNumber(
                                                        sale.item_count
                                                    )}{" "}
                                                    کاڵا
                                                </span>

                                                {sale.return_status ===
                                                    "full" && (
                                                    <span className="mt-1 inline-block rounded border border-danger px-2 py-0.5 text-xs font-bold text-danger">
                                                        {FULL_RETURN_LABEL}
                                                    </span>
                                                )}

                                                {sale.return_status ===
                                                    "partial" && (
                                                    <span className="mt-1 inline-block rounded border border-dashed border-danger px-2 py-0.5 text-xs font-bold text-danger">
                                                        {PARTIAL_RETURN_LABEL}
                                                    </span>
                                                )}
                                            </span>

                                            <span className="font-display text-lg font-bold text-ink">
                                                {formatMoney(sale.total)}
                                            </span>
                                        </button>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>
                </section>

                {/* PAYMENTS */}
                <section>
                    <h2 className="mb-4 font-display text-xl font-bold text-ink">
                        پارە وەرگیراوەکان
                    </h2>

                    <div className="overflow-hidden rounded-2xl border border-line bg-surface">
                        {payments.length === 0 ? (
                            <EmptyState
                                title="هێشتا پارە وەرنەگیراوە"
                                description="دوای هەر قستێک «پارە وەرگرتن» بکە."
                            />
                        ) : (
                            <ul className="divide-y divide-line">
                                {payments.map((payment) => (
                                    <li
                                        key={payment.payment_id}
                                        className="flex items-center gap-4 p-4"
                                    >
                                        <span className="grid size-11 shrink-0 place-items-center rounded-full bg-gold-soft text-gold-text">
                                            <Icon
                                                name="wallet"
                                                className="size-5"
                                            />
                                        </span>

                                        <span className="min-w-0 flex-1">
                                            <span className="block font-semibold text-ink">
                                                {formatDay(payment.paid_on)}
                                            </span>

                                            {payment.note && (
                                                <span className="block truncate text-sm text-muted">
                                                    {payment.note}
                                                </span>
                                            )}
                                        </span>

                                        <span className="font-display text-lg font-bold text-brand">
                                            {formatMoney(payment.amount)}
                                        </span>

                                        <button
                                            onClick={() =>
                                                handleDeletePayment(payment)
                                            }
                                            aria-label="سڕینەوەی پارە وەرگرتن"
                                            className="grid size-9 shrink-0 place-items-center rounded-lg text-muted hover:bg-danger-soft hover:text-danger"
                                        >
                                            <Icon
                                                name="trash"
                                                className="size-4.5"
                                            />
                                        </button>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>
                </section>
            </div>

            {/* RETURNS */}
            <section className="mt-8">
                <h2 className="mb-4 font-display text-xl font-bold text-ink">
                    گەڕاندنەوەکان
                </h2>

                <div className="overflow-hidden rounded-2xl border border-line bg-surface">
                    {returns.length === 0 ? (
                        <EmptyState
                            title="هێشتا کاڵا نەگەڕاوەتەوە"
                            description="لە وەسڵی کڕیار، دوگمەی «گەڕاندنەوەی کاڵا» بەکاربێنە."
                        />
                    ) : (
                        <ul className="divide-y divide-line">
                            {returns.map((waslReturn) => (
                                <li
                                    key={waslReturn.return_id}
                                    className="flex items-start gap-4 p-4"
                                >
                                    <span className="grid size-11 shrink-0 place-items-center rounded-full bg-danger-soft text-danger">
                                        <Icon name="undo" className="size-5" />
                                    </span>

                                    <span className="min-w-0 flex-1">
                                        <span className="block font-semibold text-ink">
                                            {RETURNED_LABEL} · وەسڵی{" "}
                                            {localizeDigits(
                                                String(
                                                    waslReturn.wasl_id
                                                ).padStart(4, "0")
                                            )}
                                        </span>

                                        <span className="block text-sm text-muted">
                                            {formatDate(waslReturn.created_at)}
                                        </span>

                                        <span className="mt-1 block text-sm text-ink">
                                            {waslReturn.items
                                                .map(
                                                    (item) =>
                                                        `${item.product_name}${
                                                            item.unit_name
                                                                ? ` - ${item.unit_name}`
                                                                : ""
                                                        } × ${formatNumber(item.quantity, 3)}`
                                                )
                                                .join("، ")}
                                        </span>

                                        {Number(waslReturn.refund_amount) > 0 && (
                                            <span className="mt-1 block text-xs text-muted">
                                                پارەی گەڕێنراوە بە نەقد:{" "}
                                                {formatMoney(
                                                    waslReturn.refund_amount
                                                )}
                                            </span>
                                        )}
                                    </span>

                                    <span className="text-end">
                                        <span className="block font-display text-lg font-bold text-brand">
                                            -{formatMoney(
                                                waslReturn.debt_reduction
                                            )}
                                        </span>

                                        <span className="block text-xs text-muted">
                                            لە قەرز کەمبووەوە
                                        </span>
                                    </span>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
            </section>

            {paymentOpen && (
                <PaymentModal
                    customer={customer}
                    onClose={() => setPaymentOpen(false)}
                    onSaved={handlePaymentSaved}
                />
            )}

            {editOpen && (
                <CustomerDrawer
                    customer={customer}
                    onClose={() => setEditOpen(false)}
                    onSaved={handleEditSaved}
                />
            )}

            {statementDialogOpen && (
                <StatementDialog
                    customer={customer}
                    onClose={() => setStatementDialogOpen(false)}
                    onCreated={handleStatementCreated}
                />
            )}

            {statement && (
                <StatementModal
                    statement={statement}
                    onClose={() => setStatement(null)}
                />
            )}

            {selectedWaslId && (
                <WaslViewer
                    waslId={selectedWaslId}
                    onClose={() => setSelectedWaslId(null)}
                    onChanged={fetchAll}
                />
            )}
        </div>
    );
}

export default CustomerProfile;
