import { useCallback, useEffect, useState } from "react";
import { API_URL } from "../config";
import useUi from "../hooks/useUi";
import EmptyState from "../components/EmptyState";
import Icon from "../components/Icon";
import PageHeader from "../components/PageHeader";
import Segmented from "../components/Segmented";
import WaslViewer from "../components/WaslViewer";
import {
    formatMoney,
    formatNumber,
    formatTime,
    getDayKey,
    getDayLabel,
    localizeDigits,
    normalizeText
} from "../utils/format";
import { FULL_RETURN_LABEL, PARTIAL_RETURN_LABEL } from "../utils/returns";

const periodOptions = [
    { value: "all", label: "هەموو" },
    { value: "today", label: "ئەمڕۆ" }
];

function Wasls() {
    const { toast, confirm } = useUi();

    const [wasls, setWasls] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState("");
    const [period, setPeriod] = useState("all");

    // The wasl that is open (receipt, print, return)
    const [selectedWaslId, setSelectedWaslId] = useState(null);

    const fetchWasls = useCallback(async () => {
        try {
            const response = await fetch(`${API_URL}/wasls`);

            const data = await response.json();

            setWasls(Array.isArray(data) ? data : []);
        } catch (error) {
            console.error("Error fetching wasls:", error);

            toast("نەتوانرا وەسڵەکان باربکرێن.", "error");
        } finally {
            setLoading(false);
        }
    }, [toast]);

    useEffect(() => {
        fetchWasls();
    }, [fetchWasls]);

    const handleDeleteWasl = async (wasl) => {
        const confirmed = await confirm(
            "وەسڵەکە دەسڕدرێتەوە و لە ڕاپۆرتەکانیش لادەچێت.",
            {
                title: "ئەم وەسڵە بسڕدرێتەوە؟",
                confirmLabel: "سڕینەوە",
                danger: true
            }
        );

        if (!confirmed) {
            return;
        }

        try {
            const response = await fetch(`${API_URL}/wasls/${wasl.wasl_id}`, {
                method: "DELETE"
            });

            const data = await response.json();

            if (response.status === 409) {
                toast(
                    data.code === "HAS_RETURNS"
                        ? "ئەم وەسڵە گەڕاندنەوەی هەیە، بۆیە ناسڕدرێتەوە."
                        : "ئەم وەسڵە بە قەرزە و کڕیارەکە پارەی زیاتری داوە لە قەرزی ماوە، بۆیە ناسڕدرێتەوە.",
                    "error"
                );
                return;
            }

            if (!response.ok) {
                toast(data.message || "نەتوانرا وەسڵ بسڕدرێتەوە.", "error");
                return;
            }

            setWasls((currentWasls) =>
                currentWasls.filter((item) => item.wasl_id !== wasl.wasl_id)
            );

            setSelectedWaslId(null);

            toast("وەسڵ سڕایەوە.", "success");
        } catch (error) {
            console.error("Error deleting wasl:", error);

            toast("هەڵەیەک ڕوویدا لە کاتی سڕینەوەی وەسڵ.", "error");
        }
    };

    // Filter by period, then search by receipt number or customer name
    const todayKey = getDayKey();
    const search = normalizeText(searchTerm);

    const filteredWasls = wasls.filter((wasl) => {
        if (period === "today" && getDayKey(wasl.created_at) !== todayKey) {
            return false;
        }

        return (
            String(wasl.wasl_id).includes(search) ||
            normalizeText(wasl.customer_name).includes(search)
        );
    });

    // Group by day: ئەمڕۆ, دوێنێ, older days
    const groups = [];

    filteredWasls.forEach((wasl) => {
        const dayKey = getDayKey(wasl.created_at);
        const lastGroup = groups[groups.length - 1];

        if (lastGroup && lastGroup.dayKey === dayKey) {
            lastGroup.wasls.push(wasl);
        } else {
            groups.push({ dayKey: dayKey, wasls: [wasl] });
        }
    });

    return (
        <div>
            <PageHeader
                title="وەسڵەکان"
                subtitle={
                    loading
                        ? "هەموو وەسڵە دروستکراوەکان ببینە و بچاپیان بکەرەوە."
                        : `${formatNumber(wasls.length)} وەسڵ تۆمارکراوە.`
                }
            />

            <div className="flex flex-wrap items-center gap-3">
                <div className="relative min-w-56 flex-1">
                    <Icon
                        name="search"
                        className="pointer-events-none absolute start-4 top-1/2 size-5 -translate-y-1/2 text-muted"
                    />

                    <input
                        type="text"
                        value={searchTerm}
                        onChange={(event) => setSearchTerm(event.target.value)}
                        aria-label="گەڕان بە ژمارەی وەسڵ یان ناوی کڕیار"
                        placeholder="ژمارەی وەسڵ یان ناوی کڕیار..."
                        className="w-full rounded-2xl border border-line bg-surface py-3.5 pe-4 ps-12 text-ink"
                    />
                </div>

                <Segmented
                    options={periodOptions}
                    value={period}
                    onChange={setPeriod}
                    label="ماوە"
                />
            </div>

            <div className="mt-6 space-y-7">
                {loading ? (
                    <div className="overflow-hidden rounded-2xl border border-line bg-surface">
                        <ul className="divide-y divide-line">
                            {[0, 1, 2, 3].map((row) => (
                                <li
                                    key={row}
                                    className="flex items-center gap-4 p-4"
                                >
                                    <div className="h-12 w-16 animate-pulse rounded-xl bg-surface-2" />

                                    <div className="h-5 w-40 animate-pulse rounded-lg bg-surface-2" />
                                </li>
                            ))}
                        </ul>
                    </div>
                ) : groups.length === 0 ? (
                    <div className="rounded-2xl border border-line bg-surface">
                        <EmptyState
                            title={
                                wasls.length === 0
                                    ? "هێشتا هیچ وەسڵێک دروست نەکراوە"
                                    : "هیچ وەسڵێک نەدۆزرایەوە"
                            }
                            description={
                                wasls.length === 0
                                    ? "یەکەم وەسڵ لە بەشی «وەسڵی نوێ» دروستبکە."
                                    : "گەڕان یان ماوەکە بگۆڕە."
                            }
                        />
                    </div>
                ) : (
                    groups.map((group) => (
                        <section key={group.dayKey}>
                            <h2 className="mb-2.5 font-display font-bold text-ink">
                                {getDayLabel(group.dayKey)}
                            </h2>

                            <ul className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-surface">
                                {group.wasls.map((wasl) => (
                                    <li key={wasl.wasl_id}>
                                        <button
                                            onClick={() =>
                                                setSelectedWaslId(wasl.wasl_id)
                                            }
                                            className="flex w-full items-center gap-4 p-4 text-start hover:bg-surface-2"
                                        >
                                            <span className="grid h-12 min-w-16 place-items-center rounded-xl bg-brand-soft px-2 font-display text-lg font-extrabold text-brand">
                                                {localizeDigits(
                                                    String(
                                                        wasl.wasl_id
                                                    ).padStart(4, "0")
                                                )}
                                            </span>

                                            <span className="min-w-0 flex-1">
                                                <span className="block truncate font-semibold text-ink">
                                                    {wasl.customer_name ||
                                                        "بێ ناوی کڕیار"}
                                                    {wasl.sale_type ===
                                                        "credit" && (
                                                        <span className="ms-2 rounded-full bg-gold px-2 py-0.5 align-middle text-xs font-bold text-gold-ink">
                                                            قەرز
                                                        </span>
                                                    )}
                                                </span>

                                                <span className="block text-sm text-muted">
                                                    {formatTime(
                                                        wasl.created_at
                                                    )}{" "}
                                                    · {formatNumber(
                                                        wasl.item_count
                                                    )}{" "}
                                                    کاڵا
                                                </span>

                                                {wasl.return_status ===
                                                    "full" && (
                                                    <span className="mt-1 inline-block rounded border border-danger px-2 py-0.5 text-xs font-bold text-danger">
                                                        {FULL_RETURN_LABEL}
                                                    </span>
                                                )}

                                                {wasl.return_status ===
                                                    "partial" && (
                                                    <span className="mt-1 inline-block rounded border border-dashed border-danger px-2 py-0.5 text-xs font-bold text-danger">
                                                        {PARTIAL_RETURN_LABEL}
                                                    </span>
                                                )}
                                            </span>

                                            <span className="font-display text-lg font-bold text-ink">
                                                {formatMoney(wasl.total)}
                                            </span>

                                            <Icon
                                                name="chevron"
                                                className="size-5 shrink-0 text-muted"
                                            />
                                        </button>
                                    </li>
                                ))}
                            </ul>
                        </section>
                    ))
                )}
            </div>

            {selectedWaslId && (
                <WaslViewer
                    waslId={selectedWaslId}
                    onClose={() => setSelectedWaslId(null)}
                    onChanged={fetchWasls}
                    onDelete={handleDeleteWasl}
                />
            )}
        </div>
    );
}

export default Wasls;
