import { useEffect, useState } from "react";
import { API_URL } from "../config";
import useUi from "../hooks/useUi";
import { toEnglishDigits } from "../utils/format";
import Icon from "./Icon";

// Side panel to add or edit a customer. customer = null means "new customer".
// onSaved receives the saved customer (with its totals).
function CustomerDrawer({ customer, onClose, onSaved }) {
    const { toast } = useUi();

    const [formData, setFormData] = useState({
        name: customer ? customer.name : "",
        phone: customer && customer.phone ? customer.phone : "",
        address: customer && customer.address ? customer.address : "",
        notes: customer && customer.notes ? customer.notes : ""
    });
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

    const handleChange = (field, value) => {
        setFormData((currentForm) => ({
            ...currentForm,
            // phone numbers always show normal digits (0-9)
            [field]: field === "phone" ? toEnglishDigits(value) : value
        }));
    };

    const handleSubmit = async (event) => {
        event.preventDefault();

        if (saving) {
            return;
        }

        if (!formData.name.trim()) {
            toast("ناوی کڕیار پێویستە.", "error");
            return;
        }

        setSaving(true);

        try {
            const url = customer
                ? `${API_URL}/customers/${customer.customer_id}`
                : `${API_URL}/customers`;

            const response = await fetch(url, {
                method: customer ? "PUT" : "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify(formData)
            });

            const data = await response.json();

            if (!response.ok) {
                toast(data.message || "نەتوانرا کڕیار هەڵبگیرێت.", "error");
                return;
            }

            toast(
                customer ? "گۆڕانکارییەکان هەڵگیران." : "کڕیار زیادکرا.",
                "success"
            );

            onSaved(data);
        } catch (error) {
            console.error("Error saving customer:", error);

            toast("هەڵەیەک ڕوویدا لە کاتی هەڵگرتنی کڕیار.", "error");
        } finally {
            setSaving(false);
        }
    };

    const inputClass =
        "w-full rounded-xl border border-line bg-surface px-4 py-3 text-ink";

    return (
        <div
            className="fixed inset-0 z-[70] bg-black/50 backdrop-blur-sm animate-fade print:hidden"
            onClick={onClose}
        >
            <form
                onSubmit={handleSubmit}
                onClick={(event) => event.stopPropagation()}
                className="absolute inset-y-0 end-0 flex w-full max-w-md animate-drawer flex-col bg-bg shadow-card"
            >
                <div className="flex items-center justify-between border-b border-line px-6 py-5">
                    <h2 className="font-display text-xl font-extrabold text-ink">
                        {customer ? "دەستکاریکردنی کڕیار" : "کڕیاری نوێ"}
                    </h2>

                    <button
                        type="button"
                        onClick={onClose}
                        aria-label="داخستن"
                        className="grid size-10 place-items-center rounded-full hover:bg-surface-2"
                    >
                        <Icon name="close" />
                    </button>
                </div>

                <div className="flex-1 space-y-5 overflow-y-auto px-6 py-6">
                    <label className="block">
                        <span className="mb-2 block text-sm font-medium text-ink">
                            ناو
                        </span>

                        <input
                            type="text"
                            autoFocus
                            value={formData.name}
                            onChange={(event) =>
                                handleChange("name", event.target.value)
                            }
                            disabled={saving}
                            className={inputClass}
                        />
                    </label>

                    <label className="block">
                        <span className="mb-2 block text-sm font-medium text-ink">
                            ژمارەی مۆبایل
                        </span>

                        <input
                            type="text"
                            inputMode="tel"
                            dir="ltr"
                            value={formData.phone}
                            onChange={(event) =>
                                handleChange("phone", event.target.value)
                            }
                            disabled={saving}
                            placeholder="07701234567"
                            className={`${inputClass} text-start`}
                        />
                    </label>

                    <label className="block">
                        <span className="mb-2 block text-sm font-medium text-ink">
                            ناونیشان
                        </span>

                        <input
                            type="text"
                            value={formData.address}
                            onChange={(event) =>
                                handleChange("address", event.target.value)
                            }
                            disabled={saving}
                            className={inputClass}
                        />
                    </label>

                    <label className="block">
                        <span className="mb-2 block text-sm font-medium text-ink">
                            تێبینی
                        </span>

                        <textarea
                            rows={3}
                            value={formData.notes}
                            onChange={(event) =>
                                handleChange("notes", event.target.value)
                            }
                            disabled={saving}
                            className={inputClass}
                        />
                    </label>
                </div>

                <div className="flex gap-3 border-t border-line bg-surface px-6 py-4">
                    <button
                        type="submit"
                        disabled={saving}
                        className="flex-1 rounded-xl bg-brand px-4 py-3 font-bold text-brand-ink hover:opacity-90 disabled:opacity-50"
                    >
                        {saving ? "هەڵدەگیرێت..." : "هەڵگرتن"}
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

export default CustomerDrawer;
