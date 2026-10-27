import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { API_URL } from "../config";
import BarChart from "../components/BarChart";
import EmptyState from "../components/EmptyState";
import Icon from "../components/Icon";
import PageHeader from "../components/PageHeader";
import {
    formatDateLong,
    formatMoney,
    formatNumber,
    formatTime,
    getDayKey,
    getDayLabel,
    getLastDayKeys,
    localizeDigits
} from "../utils/format";

function Dashboard() {
    const [summary, setSummary] = useState(null);
    const [today, setToday] = useState(null);
    const [debts, setDebts] = useState(null);
    const [days, setDays] = useState(null);
    const [topProducts, setTopProducts] = useState(null);
    const [recentWasls, setRecentWasls] = useState(null);

    useEffect(() => {
        fetch(`${API_URL}/wasls/reports/summary`)
            .then((response) => response.json())
            .then((data) => {
                setSummary(data);
            })
            .catch((error) => {
                console.error("Error fetching wasl summary:", error);
            });

        fetch(`${API_URL}/wasls/reports/today`)
            .then((response) => response.json())
            .then((data) => {
                setToday(data);
            })
            .catch((error) => {
                console.error("Error fetching today's wasls:", error);
            });

        fetch(`${API_URL}/customers/summary`)
            .then((response) => response.json())
            .then((data) => {
                setDebts(data);
            })
            .catch((error) => {
                console.error("Error fetching customers summary:", error);
            });

        fetch(`${API_URL}/wasls/reports/by-date`)
            .then((response) => response.json())
            .then((data) => {
                setDays(Array.isArray(data) ? data : []);
            })
            .catch((error) => {
                console.error("Error fetching wasls by date:", error);
            });

        fetch(`${API_URL}/wasls/reports/top-products`)
            .then((response) => response.json())
            .then((data) => {
                setTopProducts(Array.isArray(data) ? data.slice(0, 5) : []);
            })
            .catch((error) => {
                console.error("Error fetching top-selling products:", error);
            });

        fetch(`${API_URL}/wasls?limit=6`)
            .then((response) => response.json())
            .then((data) => {
                setRecentWasls(Array.isArray(data) ? data : []);
            })
            .catch((error) => {
                console.error("Error fetching recent wasls:", error);
            });
    }, []);

    // Last 7 days for the chart (days without sales are 0)
    const chartData = getLastDayKeys(7).map((dayKey) => {
        const day = (days || []).find((item) => item.wasl_date === dayKey);
        const value = day ? day.net_usd : 0;

        return {
            key: dayKey,
            label: localizeDigits(dayKey.slice(8)),
            title: `${getDayLabel(dayKey)}: ${formatMoney(value)}`,
            value: value
        };
    });

    const topQuantity = topProducts
        ? Math.max(...topProducts.map((product) => product.total_quantity), 1)
        : 1;

    return (
        <div>
            <PageHeader title="داشبۆرد" />

            {/* TODAY: sales | money still owed by customers */}
            <section className="lattice relative overflow-hidden rounded-3xl bg-side p-6 text-side-ink sm:p-8">
                <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                        <h2 className="font-display text-2xl font-extrabold">
                            فرۆشی ئەمڕۆ
                        </h2>

                        <p className="mt-1 text-side-muted">
                            {formatDateLong()}
                            {today && (
                                <>
                                    {" "}
                                    · {formatNumber(today.total_wasls)} وەسڵ
                                </>
                            )}
                        </p>
                    </div>

                    <Link
                        to="/pos"
                        className="flex items-center gap-2 rounded-xl bg-gold px-5 py-3 font-bold text-gold-ink hover:brightness-105"
                    >
                        <Icon name="receipt" className="size-5" />
                        وەسڵی نوێ
                    </Link>
                </div>

                <div className="mt-8 grid grid-cols-2">
                    <div className="pe-4 sm:pe-8">
                        <p className="text-sm text-side-muted">
                            فرۆشی ساف (دوای گەڕاندنەوە)
                        </p>

                        <p className="mt-1 font-display text-2xl font-extrabold sm:text-4xl">
                            {today ? formatMoney(today.net_usd) : "…"}
                        </p>

                        <p className="mt-1 text-sm text-side-muted">
                            {today
                                ? `لەمانە بە قەرز: ${formatMoney(today.credit_usd)}`
                                : ""}
                        </p>

                        {today && Number(today.returns_usd) > 0 && (
                            <p className="text-sm text-side-muted">
                                {`گەڕاندنەوە: ${formatMoney(today.returns_usd)}`}
                            </p>
                        )}
                    </div>

                    <div className="border-s-2 border-dashed border-white/25 ps-4 sm:ps-8">
                        <p className="text-sm text-side-muted">
                            قەرزی ماوەی کڕیاران
                        </p>

                        <p className="mt-1 font-display text-2xl font-extrabold sm:text-4xl">
                            {debts ? formatMoney(debts.total_outstanding) : "…"}
                        </p>

                        <p className="mt-1 text-sm text-side-muted">
                            {debts
                                ? `${formatNumber(debts.debtors_count)} کڕیاری قەرزدار`
                                : ""}
                        </p>
                    </div>
                </div>
            </section>

            {/* ALL TIME */}
            <dl className="mt-6 grid grid-cols-1 divide-y divide-line rounded-2xl border border-line bg-surface sm:grid-cols-3 sm:divide-y-0">
                <div className="px-6 py-4">
                    <dt className="text-sm text-muted">کۆی هەموو وەسڵەکان</dt>

                    <dd className="mt-0.5 font-display text-xl font-bold text-ink">
                        {summary ? formatNumber(summary.total_wasls) : "…"}
                    </dd>
                </div>

                <div className="px-6 py-4 sm:border-s sm:border-line">
                    <dt className="text-sm text-muted">کۆی فرۆشتنی ساف</dt>

                    <dd className="mt-0.5 font-display text-xl font-bold text-ink">
                        {summary ? formatMoney(summary.net_usd) : "…"}
                    </dd>
                </div>

                <div className="px-6 py-4 sm:border-s sm:border-line">
                    <dt className="text-sm text-muted">
                        پارەی نەقدی ساف ئەمڕۆ
                    </dt>

                    <dd className="mt-0.5 font-display text-xl font-bold text-ink">
                        {today ? formatMoney(today.cash_usd) : "…"}
                    </dd>
                </div>
            </dl>

            <div className="mt-8 grid gap-8 lg:grid-cols-3">
                {/* CHART */}
                <section className="lg:col-span-2">
                    <h2 className="mb-4 font-display text-xl font-bold text-ink">
                        فرۆشتنی ساف لە 7 ڕۆژی ڕابردوو
                    </h2>

                    <div className="rounded-2xl border border-line bg-surface p-5">
                        {days === null ? (
                            <div className="h-56 animate-pulse rounded-xl bg-surface-2" />
                        ) : (
                            <BarChart
                                data={chartData}
                                highlightKey={getDayKey()}
                            />
                        )}
                    </div>
                </section>

                {/* TOP PRODUCTS */}
                <section>
                    <h2 className="mb-4 font-display text-xl font-bold text-ink">
                        زۆرترین فرۆشراو
                    </h2>

                    <div className="rounded-2xl border border-line bg-surface">
                        {topProducts === null ? (
                            <div className="h-56 animate-pulse rounded-2xl bg-surface-2" />
                        ) : topProducts.length === 0 ? (
                            <EmptyState title="هێشتا فرۆشتن نییە" />
                        ) : (
                            <ol className="divide-y divide-line">
                                {topProducts.map((product) => (
                                    <li
                                        key={`${product.product_name}-${product.unit_name}`}
                                        className="px-5 py-3.5"
                                    >
                                        <div className="flex items-baseline justify-between gap-3">
                                            <span className="truncate font-semibold text-ink">
                                                {product.product_name}
                                            </span>

                                            <span className="shrink-0 text-sm text-muted">
                                                {formatNumber(
                                                    product.total_quantity,
                                                    3
                                                )}{" "}
                                                {product.unit_name}
                                            </span>
                                        </div>

                                        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-surface-2">
                                            <div
                                                className="h-full rounded-full bg-gold"
                                                style={{
                                                    width: `${(product.total_quantity / topQuantity) * 100}%`
                                                }}
                                            />
                                        </div>
                                    </li>
                                ))}
                            </ol>
                        )}
                    </div>
                </section>
            </div>

            {/* RECENT WASLS */}
            <section className="mt-8">
                <div className="mb-4 flex items-center justify-between">
                    <h2 className="font-display text-xl font-bold text-ink">
                        دوایین وەسڵەکان
                    </h2>

                    <Link
                        to="/wasls"
                        className="text-sm font-semibold text-brand hover:underline"
                    >
                        هەموویان ببینە
                    </Link>
                </div>

                <div className="overflow-hidden rounded-2xl border border-line bg-surface">
                    {recentWasls === null ? (
                        <div className="h-40 animate-pulse bg-surface-2" />
                    ) : recentWasls.length === 0 ? (
                        <EmptyState
                            title="هێشتا هیچ وەسڵێک دروست نەکراوە"
                            description="یەکەم وەسڵ لە بەشی «وەسڵی نوێ» دروستبکە."
                        />
                    ) : (
                        <ul className="divide-y divide-line">
                            {recentWasls.map((wasl) => (
                                <li
                                    key={wasl.wasl_id}
                                    className="flex items-center gap-4 p-4"
                                >
                                    <span className="grid h-11 min-w-14 place-items-center rounded-xl bg-brand-soft px-2 font-display font-extrabold text-brand">
                                        {localizeDigits(
                                            String(wasl.wasl_id).padStart(
                                                4,
                                                "0"
                                            )
                                        )}
                                    </span>

                                    <span className="min-w-0 flex-1">
                                        <span className="block truncate font-semibold text-ink">
                                            {wasl.customer_name ||
                                                "بێ ناوی کڕیار"}
                                            {wasl.sale_type === "credit" && (
                                                <span className="ms-2 rounded-full bg-gold px-2 py-0.5 align-middle text-xs font-bold text-gold-ink">
                                                    قەرز
                                                </span>
                                            )}
                                        </span>

                                        <span className="block text-sm text-muted">
                                            {getDayLabel(
                                                getDayKey(wasl.created_at)
                                            )}{" "}
                                            · {formatTime(wasl.created_at)}
                                        </span>
                                    </span>

                                    <span className="font-display font-bold text-ink">
                                        {formatMoney(wasl.total)}
                                    </span>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
            </section>
        </div>
    );
}

export default Dashboard;
