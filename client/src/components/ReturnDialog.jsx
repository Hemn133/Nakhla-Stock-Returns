import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { API_URL } from "../config";
import useUi from "../hooks/useUi";
import {
    formatMoney,
    formatNumber,
    parseNumber,
    toEnglishDigits
} from "../utils/format";
import {
    RETURNED_LABEL,
    calculateReturnPreview,
    createRequestId,
    getEligibleQuantity
} from "../utils/returns";
import Icon from "./Icon";

// Choose what to return from a wasl: one product, several, or all of it.
// The server checks everything again and does the real work in one transaction.
function ReturnDialog({ wasl, items, returns, onClose, onDone }) {
    const { toast } = useUi();

    // text typed in each quantity box: { [wasl_item_id]: "2" }
    const [texts, setTexts] = useState({});
    const [note, setNote] = useState("");
    const [submitting, setSubmitting] = useState(false);

    // what the customer owes now (credit wasls): needed to show the effect
    const [balance, setBalance] = useState(null);

    // One id for this return: a double click or a retry can never apply it twice
    const requestId = useRef(createRequestId());

    const isCredit = wasl.sale_type === "credit";

    useEffect(() => {
        if (!isCredit) {
            return;
        }

        fetch(`${API_URL}/customers/${wasl.customer_id}`)
            .then((response) => response.json())
            .then((data) => {
                setBalance(Number(data.balance));
            })
            .catch((error) => {
                console.error("Error fetching customer balance:", error);
            });
    }, [isCredit, wasl.customer_id]);

    useEffect(() => {
        const handleKeyDown = (event) => {
            if (event.key === "Escape" && !submitting) {
                onClose();
            }
        };

        window.addEventListener("keydown", handleKeyDown);

        return () => {
            window.removeEventListener("keydown", handleKeyDown);
        };
    }, [onClose, submitting]);

    // ---------- quantities ----------

    // Every line: what was typed, what is allowed, and if it is valid
    const rows = items.map((item) => {
        const eligible = getEligibleQuantity(item);
        const text = texts[item.wasl_item_id] || "";
        const parsed = text.trim() === "" ? 0 : parseNumber(text);

        let error = "";

        if (parsed === null || parsed < 0) {
            error = "ژمارەیەکی دروست بنووسە.";
        } else if (Math.abs(parsed * 1000 - Math.round(parsed * 1000)) > 1e-6) {
            error = "تەنها سێ ژمارە دوای ناوەڕاست.";
        } else if (parsed > eligible) {
            error = `زیاتر لە ${formatNumber(eligible, 3)} ناگەڕێتەوە.`;
        }

        return {
            item: item,
            eligible: eligible,
            text: text,
            quantity: error || parsed === null ? 0 : parsed,
            error: error
        };
    });

    const quantities = Object.fromEntries(
        rows
            .filter((row) => row.quantity > 0)
            .map((row) => [row.item.wasl_item_id, row.quantity])
    );

    const hasError = rows.some((row) => row.error);
    const selectedCount = Object.keys(quantities).length;

    const preview = calculateReturnPreview({
        wasl: wasl,
        items: items,
        returns: returns,
        quantities: quantities,
        balance: balance
    });

    const handleChange = (itemId, value) => {
        setTexts((currentTexts) => ({
            ...currentTexts,
            // the box always shows normal digits (0-9)
            [itemId]: toEnglishDigits(value)
        }));
    };

    const handleReturnAllOfLine = (row) => {
        handleChange(row.item.wasl_item_id, String(row.eligible));
    };

    // The whole wasl = everything that is still eligible
    const handleReturnWholeWasl = () => {
        const next = {};

        rows.forEach((row) => {
            if (row.eligible > 0) {
                next[row.item.wasl_item_id] = String(row.eligible);
            }
        });

        setTexts(next);
    };

    // ---------- confirm ----------

    const handleSubmit = async () => {
        if (submitting) {
            return;
        }

        if (hasError || selectedCount === 0) {
            toast("بڕی گەڕاندنەوە دیاریبکە.", "error");
            return;
        }

        setSubmitting(true);

        try {
            const response = await fetch(
                `${API_URL}/wasls/${wasl.wasl_id}/returns`,
                {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json"
                    },
                    body: JSON.stringify({
                        request_id: requestId.current,
                        note: note.trim(),
                        items: Object.entries(quantities).map(
                            ([waslItemId, quantity]) => ({
                                wasl_item_id: Number(waslItemId),
                                quantity: quantity
                            })
                        )
                    })
                }
            );

            const data = await response.json();

            if (!response.ok) {
                if (data.code === "EXCEEDS_ELIGIBLE") {
                    toast(
                        "ئەو بڕە لەوەی ماوە زیاترە (ڕەنگە پێشتر گەڕابێتەوە). وەسڵەکە نوێ دەکرێتەوە.",
                        "error"
                    );

                    // show the real quantities again
                    onDone(data, true);
                    return;
                }

                toast(data.message || "نەتوانرا گەڕاندنەوە تۆمار بکرێت.", "error");

                return;
            }

            toast(
                data.duplicate
                    ? "ئەم گەڕاندنەوەیە پێشتر تۆمارکراوە."
                    : "گەڕاندنەوە تۆمارکرا.",
                "success"
            );

            onDone(data, false);
        } catch (error) {
            console.error("Error saving return:", error);

            toast("هەڵەیەک ڕوویدا لە کاتی تۆمارکردنی گەڕاندنەوە.", "error");
        } finally {
            setSubmitting(false);
        }
    };

    const inputClass = (row) =>
        `w-20 rounded-xl border bg-surface-2 px-2 py-2 text-center font-bold text-ink ${
            row.error ? "border-danger" : "border-line"
        }`;

    return createPortal(
        <div
            className="fixed inset-0 z-[75] overflow-y-auto bg-black/60 p-4 backdrop-blur-sm animate-fade print:hidden"
            onClick={() => !submitting && onClose()}
        >
            <div
                role="dialog"
                aria-modal="true"
                className="mx-auto my-6 w-full max-w-lg rounded-3xl bg-surface p-6 shadow-card"
                onClick={(event) => event.stopPropagation()}
            >
                <div className="flex items-start justify-between gap-3">
                    <div>
                        <h2 className="font-display text-xl font-extrabold text-ink">
                            گەڕاندنەوەی کاڵا
                        </h2>

                        <p className="mt-1 text-sm text-muted">
                            وەسڵی ژمارە {wasl.wasl_id}
                            {isCredit ? " · فرۆشتن بە قەرز" : " · نەقد"}
                        </p>
                    </div>

                    <button
                        onClick={onClose}
                        disabled={submitting}
                        aria-label="داخستن"
                        className="grid size-9 place-items-center rounded-full hover:bg-surface-2 disabled:opacity-50"
                    >
                        <Icon name="close" className="size-5" />
                    </button>
                </div>

                <button
                    onClick={handleReturnWholeWasl}
                    disabled={submitting}
                    className="mt-4 w-full rounded-xl border border-brand px-4 py-2.5 font-semibold text-brand hover:bg-brand-soft disabled:opacity-50"
                >
                    گەڕاندنەوەی هەموو وەسڵەکە
                </button>

                <ul className="mt-4 divide-y divide-line rounded-2xl border border-line">
                    {rows.map((row) => (
                        <li key={row.item.wasl_item_id} className="p-4">
                            <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                    <p className="font-semibold text-ink">
                                        {row.item.product_name}
                                    </p>

                                    <p className="text-sm text-muted">
                                        {row.item.unit_name
                                            ? `${row.item.unit_name} · `
                                            : ""}
                                        {formatMoney(row.item.unit_price)}
                                    </p>

                                    <p className="mt-1 text-xs text-muted">
                                        کڕدراو: {formatNumber(row.item.quantity, 3)}
                                        {Number(row.item.returned_quantity) > 0 && (
                                            <>
                                                {" "}
                                                · {RETURNED_LABEL}:{" "}
                                                {formatNumber(
                                                    row.item.returned_quantity,
                                                    3
                                                )}
                                            </>
                                        )}
                                        {" "}
                                        · دەکرێت بگەڕێتەوە:{" "}
                                        <span className="font-bold text-ink">
                                            {formatNumber(row.eligible, 3)}
                                        </span>
                                    </p>
                                </div>

                                {row.eligible > 0 ? (
                                    <div className="flex shrink-0 items-center gap-2">
                                        <input
                                            type="text"
                                            inputMode="decimal"
                                            dir="ltr"
                                            value={row.text}
                                            onChange={(event) =>
                                                handleChange(
                                                    row.item.wasl_item_id,
                                                    event.target.value
                                                )
                                            }
                                            disabled={submitting}
                                            placeholder="0"
                                            aria-label={`بڕی گەڕاندنەوەی ${row.item.product_name}`}
                                            className={inputClass(row)}
                                        />

                                        <button
                                            onClick={() => handleReturnAllOfLine(row)}
                                            disabled={submitting}
                                            className="rounded-lg px-2 py-2 text-sm font-medium text-brand hover:bg-brand-soft disabled:opacity-50"
                                        >
                                            هەمووی
                                        </button>
                                    </div>
                                ) : (
                                    <span className="shrink-0 rounded border border-line px-2 py-1 text-sm font-bold text-muted">
                                        {RETURNED_LABEL}
                                    </span>
                                )}
                            </div>

                            {row.error && (
                                <p className="mt-2 text-sm text-danger">
                                    {row.error}
                                </p>
                            )}
                        </li>
                    ))}
                </ul>

                <label className="mt-4 block">
                    <span className="mb-1 block text-xs text-muted">
                        تێبینی (دڵخواز)
                    </span>

                    <input
                        type="text"
                        value={note}
                        onChange={(event) => setNote(event.target.value)}
                        disabled={submitting}
                        className="w-full rounded-xl border border-line bg-surface-2 px-3 py-2.5 text-ink"
                    />
                </label>

                {/* The effect of this return */}
                <div className="mt-5 rounded-2xl bg-surface-2 p-4 text-sm">
                    <div className="flex items-center justify-between">
                        <span className="text-muted">نرخی کاڵا گەڕاوەکان</span>

                        <span className="font-semibold text-ink">
                            {formatMoney(preview.goods)}
                        </span>
                    </div>

                    {Number(wasl.discount) > 0 && (
                        <div className="mt-1 flex items-center justify-between">
                            <span className="text-muted">دوای داشکاندنی وەسڵەکە</span>

                            <span className="font-semibold text-ink">
                                {formatMoney(preview.net)}
                            </span>
                        </div>
                    )}

                    {isCredit ? (
                        <>
                            <div className="mt-1 flex items-center justify-between">
                                <span className="text-muted">
                                    لە قەرزی کڕیار کەم دەبێتەوە
                                </span>

                                <span className="font-bold text-brand">
                                    {formatMoney(preview.debtReduction)}
                                </span>
                            </div>

                            {preview.refund > 0 && (
                                <div className="mt-1 flex items-center justify-between">
                                    <span className="text-muted">
                                        بە نەقد دەگەڕێتەوە بۆ کڕیار (چونکە پێشتر پارەی داوە)
                                    </span>

                                    <span className="font-bold text-danger">
                                        {formatMoney(preview.refund)}
                                    </span>
                                </div>
                            )}

                            <div className="mt-2 flex items-center justify-between border-t border-line pt-2">
                                <span className="text-muted">قەرزی ئێستا ← دوای گەڕاندنەوە</span>

                                <span className="font-bold text-ink">
                                    {balance === null
                                        ? "…"
                                        : `${formatMoney(balance)} ← ${formatMoney(preview.newBalance)}`}
                                </span>
                            </div>
                        </>
                    ) : (
                        <div className="mt-1 flex items-center justify-between">
                            <span className="text-muted">
                                پارەی گەڕێنراوە بۆ کڕیار (نەقد)
                            </span>

                            <span className="font-bold text-danger">
                                {formatMoney(preview.refund)}
                            </span>
                        </div>
                    )}

                    <p className="mt-3 text-xs leading-5 text-muted">
                        ستۆکی ئەو کاڵایانەی ستۆکیان تۆمارکراوە، دەگەڕێتەوە. بڕی کۆتایی لەلایەن
                        سێرڤەرەوە دووبارە دەژمێردرێتەوە.
                    </p>
                </div>

                <div className="mt-5 flex gap-3">
                    <button
                        onClick={handleSubmit}
                        disabled={submitting || selectedCount === 0 || hasError}
                        className="flex-1 rounded-xl bg-brand px-4 py-3 font-bold text-brand-ink hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                        {submitting
                            ? "تۆمار دەکرێت..."
                            : "پشتڕاستکردنەوەی گەڕاندنەوە"}
                    </button>

                    <button
                        onClick={onClose}
                        disabled={submitting}
                        className="rounded-xl border border-line px-5 py-3 font-semibold text-ink hover:bg-surface-2 disabled:opacity-50"
                    >
                        هەڵوەشاندنەوە
                    </button>
                </div>
            </div>
        </div>,
        document.body
    );
}

export default ReturnDialog;
