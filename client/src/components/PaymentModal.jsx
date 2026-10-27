import { useEffect, useState } from "react";
import { API_URL } from "../config";
import useUi from "../hooks/useUi";
import {
    formatMoney,
    getDayKey,
    hasMaxTwoDecimals,
    isValidDateString,
    parseNumber,
    toEnglishDigits
} from "../utils/format";
import DateInput from "./DateInput";

// Record money received from a customer (an installment).
// The server checks it again and never lets it go above the debt.
function PaymentModal({ customer, onClose, onSaved }) {
    const { toast } = useUi();

    const balance = Number(customer.balance);

    const [amountText, setAmountText] = useState("");
    const [paidOn, setPaidOn] = useState(getDayKey());
    const [note, setNote] = useState("");
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        const handleKeyDown = (event) => {
            if (event.key === "Escape") {
                onClose();
            }
        };

        window.addEventListener("keydown", handleKeyDown);

        return () => {
            window.removeEventListener("keydown", handleKeyDown);
        };
    }, [onClose]);

    const handleSubmit = async (event) => {
        event.preventDefault();

        if (saving) {
            return;
        }

        const amount = parseNumber(amountText);

        if (amount === null || amount <= 0 || !hasMaxTwoDecimals(amount)) {
            toast("بڕی پارە دەبێت لە سفر زیاتر بێت (دوو ژمارە دوای ناوەڕاست).", "error");
            return;
        }

        if (Math.round(amount * 100) > Math.round(balance * 100)) {
            toast(`بڕی پارە لە قەرزی ماوە (${formatMoney(balance)}) زیاترە.`, "error");
            return;
        }

        if (!isValidDateString(paidOn)) {
            toast("بەرواری پارە وەرگرتن بنووسە، بۆ نموونە 2026-10-14.", "error");
            return;
        }

        setSaving(true);

        try {
            const response = await fetch(
                `${API_URL}/customers/${customer.customer_id}/payments`,
                {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json"
                    },
                    body: JSON.stringify({
                        amount: amount,
                        paid_on: paidOn,
                        note: note.trim()
                    })
                }
            );

            const data = await response.json();

            if (!response.ok) {
                toast(data.message || "نەتوانرا پارەکە تۆمار بکرێت.", "error");
                return;
            }

            toast(
                `پارە وەرگیرا. ماوە: ${formatMoney(data.balance_after)}`,
                "success"
            );

            onSaved();
        } catch (error) {
            console.error("Error saving payment:", error);

            toast("هەڵەیەک ڕوویدا لە کاتی تۆمارکردنی پارە.", "error");
        } finally {
            setSaving(false);
        }
    };

    return (
        <div
            className="fixed inset-0 z-[70] grid place-items-center bg-black/55 p-4 backdrop-blur-sm animate-fade print:hidden"
            onClick={onClose}
        >
            <form
                onSubmit={handleSubmit}
                onClick={(event) => event.stopPropagation()}
                className="w-full max-w-md rounded-3xl bg-surface p-6 shadow-card"
            >
                <h2 className="font-display text-xl font-extrabold text-ink">
                    پارە وەرگرتن
                </h2>

                <p className="mt-1 text-muted">
                    {customer.name} · قەرزی ماوە:{" "}
                    <span className="font-bold text-danger">
                        {formatMoney(balance)}
                    </span>
                </p>

                <div className="mt-5 space-y-4">
                    <label className="block">
                        <span className="mb-1 block text-xs text-muted">
                            بڕی پارە ($)
                        </span>

                        <div className="flex gap-2">
                            <input
                                type="text"
                                inputMode="decimal"
                                dir="ltr"
                                autoFocus
                                value={amountText}
                                onChange={(event) =>
                                    setAmountText(
                                        toEnglishDigits(event.target.value)
                                    )
                                }
                                disabled={saving}
                                placeholder="0"
                                className="w-full rounded-xl border border-line bg-surface-2 px-3 py-3 text-center text-lg font-bold text-ink"
                            />

                            <button
                                type="button"
                                onClick={() => setAmountText(String(balance))}
                                disabled={saving}
                                className="shrink-0 rounded-xl border border-line px-3 text-sm font-medium text-brand hover:bg-brand-soft"
                            >
                                هەموو قەرزەکە
                            </button>
                        </div>
                    </label>

                    <DateInput
                        label="بەرواری پارە وەرگرتن"
                        value={paidOn}
                        onChange={setPaidOn}
                        disabled={saving}
                    />

                    <label className="block">
                        <span className="mb-1 block text-xs text-muted">
                            تێبینی (دڵخواز)
                        </span>

                        <input
                            type="text"
                            value={note}
                            onChange={(event) => setNote(event.target.value)}
                            disabled={saving}
                            className="w-full rounded-xl border border-line bg-surface-2 px-3 py-2.5 text-ink"
                        />
                    </label>
                </div>

                <div className="mt-6 flex gap-3">
                    <button
                        type="submit"
                        disabled={saving}
                        className="flex-1 rounded-xl bg-gold px-4 py-3 font-bold text-gold-ink hover:opacity-90 disabled:opacity-50"
                    >
                        {saving ? "تۆمار دەکرێت..." : "تۆمارکردن"}
                    </button>

                    <button
                        type="button"
                        onClick={onClose}
                        disabled={saving}
                        className="rounded-xl border border-line px-5 py-3 font-semibold text-ink hover:bg-surface-2"
                    >
                        هەڵوەشاندنەوە
                    </button>
                </div>
            </form>
        </div>
    );
}

export default PaymentModal;
