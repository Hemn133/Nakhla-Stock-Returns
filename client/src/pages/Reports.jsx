import { useEffect, useState } from "react";
import { API_URL } from "../config";
import BarChart from "../components/BarChart";
import EmptyState from "../components/EmptyState";
import PageHeader from "../components/PageHeader";
import Segmented from "../components/Segmented";
import {
    formatMoney,
    formatNumber,
    getDayKey,
    getDayLabel,
    getLastDayKeys,
    localizeDigits
} from "../utils/format";

const rangeOptions = [7, 30, 90].map((days) => ({
    value: days,
    label: `${localizeDigits(days)} ڕۆژ`
}));

function Reports() {
    const [days, setDays] = useState(null);
    const [topProducts, setTopProducts] = useState(null);

    const [range, setRange] = useState(7);

    useEffect(() => {
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
                setTopProducts(Array.isArray(data) ? data : []);
            })
            .catch((error) => {
                console.error("Error fetching top-selling products:", error);
            });
    }, []);

    // The days of the chosen range (days without activity are 0)
    const dayKeys = getLastDayKeys(range);

    const rangeDays = dayKeys.map((dayKey) => {
        const day = (days || []).find((item) => item.wasl_date === dayKey);

        return {
            dayKey: dayKey,
            total_wasls: day ? day.total_wasls : 0,
            total_usd: day ? day.total_usd : 0,
            credit_usd: day ? day.credit_usd : 0,
            payments_usd: day ? day.payments_usd : 0,
            returns_usd: day ? day.returns_usd : 0,
            net_usd: day ? day.net_usd : 0,
            cash_usd: day ? day.cash_usd : 0
        };
    });

    // Money is added in cents so there are no rounding errors
    const totals = rangeDays.reduce(
        (sum, day) => ({
            wasls: sum.wasls + day.total_wasls,
            sales: sum.sales + Math.round(day.total_usd * 100),
            credit: sum.credit + Math.round(day.credit_usd * 100),
            payments: sum.payments + Math.round(day.payments_usd * 100),
            returns: sum.returns + Math.round(day.returns_usd * 100),
            net: sum.net + Math.round(day.net_usd * 100),
            cash: sum.cash + Math.round(day.cash_usd * 100)
        }),
        { wasls: 0, sales: 0, credit: 0, payments: 0, returns: 0, net: 0, cash: 0 }
    );

    // With many days only some labels are shown, so they do not overlap
    const labelEvery = range <= 7 ? 1 : range <= 30 ? 5 : 10;

    const chartData = rangeDays.map((day, index) => ({
        key: day.dayKey,
        label:
            index % labelEvery === 0 || index === rangeDays.length - 1
                ? localizeDigits(day.dayKey.slice(8))
                : "",
        title: `${getDayLabel(day.dayKey)}: ${formatMoney(day.net_usd)}`,
        value: day.net_usd
    }));

    // Table: only days with sales or payments, newest first
    const activeDays = rangeDays
        .filter(
            (day) =>
                day.total_wasls > 0 ||
                day.payments_usd > 0 ||
                day.returns_usd > 0
        )
        .reverse();

    const topQuantity = topProducts
        ? Math.max(...topProducts.map((product) => product.total_quantity), 1)
        : 1;

    const statCards = [
        { title: "ژمارەی وەسڵ", value: formatNumber(totals.wasls) },
        { title: "کۆی فرۆشتن", value: formatMoney(totals.sales / 100) },
        { title: "گەڕاندنەوەی کاڵا", value: formatMoney(totals.returns / 100) },
        { title: "فرۆشتنی ساف", value: formatMoney(totals.net / 100) },
        { title: "لەمانە بە قەرز", value: formatMoney(totals.credit / 100) },
        {
            title: "پارەی وەرگیراو لە کڕیاران",
            value: formatMoney(totals.payments / 100)
        },
        { title: "پارەی نەقدی ساف", value: formatMoney(totals.cash / 100) }
    ];

    return (
        <div>
            <PageHeader
                title="ڕاپۆرتەکان"
                subtitle="فرۆشتنی ساف (دوای گەڕاندنەوە)، قەرز، پارە وەرگرتن و پارەی نەقد بەپێی ماوە."
            >
                <Segmented
                    options={rangeOptions}
                    value={range}
                    onChange={setRange}
                    label="ماوە"
                />
            </PageHeader>

            <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-line bg-line lg:grid-cols-4">
                {statCards.map((card) => (
                    <div key={card.title} className="bg-surface px-6 py-4">
                        <dt className="text-sm text-muted">{card.title}</dt>

                        <dd className="mt-0.5 font-display text-2xl font-bold text-ink">
                            {days ? card.value : "…"}
                        </dd>
                    </div>
                ))}
            </dl>

            <section className="mt-8">
                <h2 className="mb-4 font-display text-xl font-bold text-ink">
                    فرۆشتنی ساف بەپێی ڕۆژ
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

            <div className="mt-8 grid gap-8 lg:grid-cols-2">
                <section>
                    <h2 className="mb-4 font-display text-xl font-bold text-ink">
                        ڕۆژەکان
                    </h2>

                    <div className="overflow-hidden rounded-2xl border border-line bg-surface">
                        {days === null ? (
                            <div className="h-40 animate-pulse bg-surface-2" />
                        ) : activeDays.length === 0 ? (
                            <EmptyState
                                title="لەم ماوەیەدا هیچ جموجۆڵێک نییە"
                                description="ماوەیەکی درێژتر هەڵبژێرە."
                            />
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full">
                                    <thead className="bg-surface-2 text-sm text-muted">
                                        <tr>
                                            <th className="px-4 py-3 text-start font-medium">
                                                ڕۆژ
                                            </th>

                                            <th className="px-4 py-3 text-start font-medium">
                                                وەسڵ
                                            </th>

                                            <th className="px-4 py-3 text-start font-medium">
                                                فرۆشتن
                                            </th>

                                            <th className="px-4 py-3 text-start font-medium">
                                                گەڕاندنەوە
                                            </th>

                                            <th className="px-4 py-3 text-start font-medium">
                                                ساف
                                            </th>

                                            <th className="px-4 py-3 text-start font-medium">
                                                بە قەرز
                                            </th>

                                            <th className="px-4 py-3 text-start font-medium">
                                                وەرگیراو
                                            </th>

                                            <th className="px-4 py-3 text-start font-medium">
                                                نەقد
                                            </th>
                                        </tr>
                                    </thead>

                                    <tbody className="divide-y divide-line">
                                        {activeDays.map((day) => (
                                            <tr key={day.dayKey}>
                                                <td className="px-4 py-3 font-semibold text-ink">
                                                    {getDayLabel(day.dayKey)}
                                                </td>

                                                <td className="px-4 py-3">
                                                    {formatNumber(
                                                        day.total_wasls
                                                    )}
                                                </td>

                                                <td className="px-4 py-3">
                                                    {formatMoney(
                                                        day.total_usd
                                                    )}
                                                </td>

                                                <td className="px-4 py-3">
                                                    {formatMoney(
                                                        day.returns_usd
                                                    )}
                                                </td>

                                                <td className="px-4 py-3 font-semibold">
                                                    {formatMoney(day.net_usd)}
                                                </td>

                                                <td className="px-4 py-3">
                                                    {formatMoney(
                                                        day.credit_usd
                                                    )}
                                                </td>

                                                <td className="px-4 py-3">
                                                    {formatMoney(
                                                        day.payments_usd
                                                    )}
                                                </td>

                                                <td className="px-4 py-3">
                                                    {formatMoney(day.cash_usd)}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                </section>

                <section>
                    <h2 className="mb-4 font-display text-xl font-bold text-ink">
                        کاڵا زۆرفرۆشەکان
                    </h2>

                    <div className="overflow-hidden rounded-2xl border border-line bg-surface">
                        {topProducts === null ? (
                            <div className="h-40 animate-pulse bg-surface-2" />
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
                                            <span className="font-semibold text-ink">
                                                {product.product_name}
                                                {product.unit_name && (
                                                    <span className="ms-2 text-sm font-normal text-muted">
                                                        {product.unit_name}
                                                    </span>
                                                )}
                                            </span>

                                            <span className="shrink-0 text-sm font-semibold text-ink">
                                                {formatNumber(
                                                    product.total_quantity,
                                                    3
                                                )}
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

                                        <p className="mt-1.5 text-xs text-muted">
                                            {formatMoney(product.revenue_usd)}
                                        </p>
                                    </li>
                                ))}
                            </ol>
                        )}
                    </div>
                </section>
            </div>
        </div>
    );
}

export default Reports;
