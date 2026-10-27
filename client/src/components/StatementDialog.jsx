import { useEffect, useState } from "react";
import { API_URL } from "../config";
import useUi from "../hooks/useUi";
import { getDayKey, isValidDateString } from "../utils/format";
import DateInput from "./DateInput";
import Segmented from "./Segmented";

const modeOptions = [
    { value: "complete", label: "هەموو کەشفەکە" },
    { value: "range", label: "ماوەیەک" }
];

// Choose which statement to create: the complete one, or a period.
// onCreated receives the statement that the server calculated.
function StatementDialog({ customer, onClose, onCreated }) {
    const { toast } = useUi();

    const today = getDayKey();

    const [mode, setMode] = useState("complete");
    const [from, setFrom] = useState(`${today.slice(0, 8)}01`);
    const [to, setTo] = useState(today);
    const [loading, setLoading] = useState(false);

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

        if (loading) {
            return;
        }

        if (mode === "range") {
            if (!isValidDateString(from) || !isValidDateString(to)) {
                toast("بەروارەکان بنووسە، بۆ نموونە 2026-10-14.", "error");
                return;
            }

            if (from > to) {
                toast("بەرواری دەستپێک نابێت دوای بەرواری کۆتایی بێت.", "error");
                return;
            }
        }

        setLoading(true);

        try {
            const query =
                mode === "range"
                    ? `?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`
                    : "";

            const response = await fetch(
                `${API_URL}/customers/${customer.customer_id}/statement${query}`
            );

            const data = await response.json();

            if (!response.ok) {
                toast(data.message || "نەتوانرا کەشفی حساب دروستبکرێت.", "error");
                return;
            }

            onCreated(data);
        } catch (error) {
            console.error("Error creating statement:", error);

            toast("هەڵەیەک ڕوویدا لە کاتی دروستکردنی کەشفی حساب.", "error");
        } finally {
            setLoading(false);
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
                    کشف حساب
                </h2>

                <p className="mt-1 text-muted">{customer.name}</p>

                <div className="mt-5">
                    <Segmented
                        options={modeOptions}
                        value={mode}
                        onChange={setMode}
                        label="جۆری کەشف"
                        disabled={loading}
                    />
                </div>

                {mode === "complete" ? (
                    <p className="mt-4 text-sm leading-6 text-muted">
                        هەموو فرۆشتنە بە قەرزەکان و پارە وەرگیراوەکانی ئەم کڕیارە، لە
                        سەرەتاوە تا ئێستا، لە یەک وەسڵی گەورەدا.
                    </p>
                ) : (
                    <div className="mt-4 grid grid-cols-2 gap-3">
                        <DateInput
                            label="لە بەرواری"
                            value={from}
                            onChange={setFrom}
                            disabled={loading}
                        />

                        <DateInput
                            label="تا بەرواری"
                            value={to}
                            onChange={setTo}
                            disabled={loading}
                        />

                        <p className="col-span-2 text-sm leading-6 text-muted">
                            قەرزی پێش ئەم ماوەیە وەک «قەرزی پێشوو» لە سەرەتای خشتەکە
                            دەنووسرێت، بۆ ئەوەی ماوە دروست بێت.
                        </p>
                    </div>
                )}

                <div className="mt-6 flex gap-3">
                    <button
                        type="submit"
                        disabled={loading}
                        className="flex-1 rounded-xl bg-brand px-4 py-3 font-bold text-brand-ink hover:opacity-90 disabled:opacity-50"
                    >
                        {loading ? "دروست دەکرێت..." : "دروستکردن"}
                    </button>

                    <button
                        type="button"
                        onClick={onClose}
                        disabled={loading}
                        className="rounded-xl border border-line px-5 py-3 font-semibold text-ink hover:bg-surface-2"
                    >
                        هەڵوەشاندنەوە
                    </button>
                </div>
            </form>
        </div>
    );
}

export default StatementDialog;
