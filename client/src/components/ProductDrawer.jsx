import { useEffect, useState } from "react";
import { API_URL } from "../config";
import useUi from "../hooks/useUi";
import {
    hasMaxTwoDecimals,
    numberToInput,
    parseNumber,
    toEnglishDigits
} from "../utils/format";
import Icon from "./Icon";

const unitSuggestions = [
    "دانە",
    "بۆکس",
    "پاکەت",
    "دەستە",
    "کارتۆن",
    "کیلۆ",
    "گرام",
    "لیتر",
    "بتل",
    "تۆپ"
];

// unit_id keeps an existing unit the same unit when the product is saved
// (so its stock and its sales stay linked). stock_quantity empty = not tracked.
const emptyUnit = {
    unit_id: null,
    unit_name: "",
    price_usd: "",
    stock_quantity: ""
};

const getInitialForm = (product) => {
    if (!product) {
        return {
            name: "",
            units: [{ ...emptyUnit, unit_name: "دانە" }]
        };
    }

    return {
        name: product.name,
        units: product.units.map((unit) => ({
            unit_id: unit.unit_id,
            unit_name: unit.unit_name,
            price_usd: numberToInput(unit.price_usd),
            stock_quantity:
                unit.stock_quantity === null
                    ? ""
                    : numberToInput(unit.stock_quantity)
        }))
    };
};

// Side panel to add or edit a product. product = null means "new product".
function ProductDrawer({ product, onClose, onSaved }) {
    const { toast } = useUi();

    const [formData, setFormData] = useState(() => getInitialForm(product));
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

    const handleUnitChange = (index, field, value) => {
        setFormData((currentForm) => ({
            ...currentForm,
            units: currentForm.units.map((unit, unitIndex) =>
                unitIndex === index
                    ? {
                          ...unit,
                          // the price box always shows normal digits (0-9)
                          [field]:
                              field === "price_usd" ||
                              field === "stock_quantity"
                                  ? toEnglishDigits(value)
                                  : value
                      }
                    : unit
            )
        }));
    };

    const handleAddUnit = () => {
        setFormData((currentForm) => ({
            ...currentForm,
            units: [...currentForm.units, { ...emptyUnit }]
        }));
    };

    const handleRemoveUnit = (index) => {
        setFormData((currentForm) => ({
            ...currentForm,
            units: currentForm.units.filter(
                (unit, unitIndex) => unitIndex !== index
            )
        }));
    };

    const handleSubmit = async (event) => {
        event.preventDefault();

        if (saving) {
            return;
        }

        if (!formData.name.trim()) {
            toast("ناوی کاڵا پێویستە.", "error");
            return;
        }

        const units = [];

        for (const unit of formData.units) {
            const unitName = unit.unit_name.trim();

            if (!unitName) {
                toast("ناوی هەموو یەکەکان پێویستە.", "error");
                return;
            }

            const priceUsd = parseNumber(unit.price_usd);

            if (priceUsd === null) {
                toast(`بۆ یەکەی "${unitName}" نرخێک بنووسە.`, "error");
                return;
            }

            if (priceUsd < 0 || !hasMaxTwoDecimals(priceUsd)) {
                toast(
                    "نرخ دەبێت ژمارەیەکی نەنەرێنی بێت و تەنها دوو ژمارە دوای ناوەڕاست.",
                    "error"
                );
                return;
            }

            // Stock is optional: empty = this unit's stock is not tracked
            let stockQuantity = null;

            if (unit.stock_quantity.trim() !== "") {
                stockQuantity = parseNumber(unit.stock_quantity);

                if (
                    stockQuantity === null ||
                    stockQuantity < 0 ||
                    Math.abs(
                        stockQuantity * 1000 - Math.round(stockQuantity * 1000)
                    ) > 1e-6
                ) {
                    toast(
                        `ستۆکی یەکەی "${unitName}" دەبێت ژمارەیەکی نەنەرێنی بێت.`,
                        "error"
                    );
                    return;
                }
            }

            units.push({
                unit_id: unit.unit_id,
                unit_name: unitName,
                price_usd: priceUsd,
                stock_quantity: stockQuantity
            });
        }

        setSaving(true);

        try {
            const url = product
                ? `${API_URL}/products/${product.product_id}`
                : `${API_URL}/products`;

            const response = await fetch(url, {
                method: product ? "PUT" : "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    name: formData.name.trim(),
                    units: units
                })
            });

            const data = await response.json();

            if (!response.ok) {
                toast(data.message || "نەتوانرا کاڵا هەڵبگیرێت.", "error");
                return;
            }

            toast(
                product ? "گۆڕانکارییەکان هەڵگیران." : "کاڵا زیادکرا.",
                "success"
            );

            onSaved();
        } catch (error) {
            console.error("Error saving product:", error);

            toast("هەڵەیەک ڕوویدا لە کاتی هەڵگرتنی کاڵا.", "error");
        } finally {
            setSaving(false);
        }
    };

    return (
        <div
            className="fixed inset-0 z-[60] bg-black/50 backdrop-blur-sm animate-fade print:hidden"
            onClick={onClose}
        >
            <form
                onSubmit={handleSubmit}
                onClick={(event) => event.stopPropagation()}
                className="absolute inset-y-0 end-0 flex w-full max-w-lg animate-drawer flex-col bg-bg shadow-card"
            >
                <div className="flex items-center justify-between border-b border-line px-6 py-5">
                    <h2 className="font-display text-xl font-extrabold text-ink">
                        {product ? "دەستکاریکردنی کاڵا" : "کاڵای نوێ"}
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

                <div className="flex-1 space-y-7 overflow-y-auto px-6 py-6">
                    <div>
                        <label
                            htmlFor="product-name"
                            className="mb-2 block text-sm font-medium text-ink"
                        >
                            ناوی کاڵا
                        </label>

                        <input
                            id="product-name"
                            type="text"
                            autoFocus
                            value={formData.name}
                            onChange={(event) =>
                                setFormData((currentForm) => ({
                                    ...currentForm,
                                    name: event.target.value
                                }))
                            }
                            disabled={saving}
                            className="w-full rounded-xl border border-line bg-surface px-4 py-3 text-ink"
                        />
                    </div>

                    <div>
                        <h3 className="font-display font-bold text-ink">
                            یەکەکان و نرخ
                        </h3>

                        <p className="mt-1 text-sm leading-6 text-muted">
                            نرخی هەر یەکەیەک بە دۆلار بنووسە.
                        </p>

                        <ul className="mt-4 space-y-4">
                            {formData.units.map((unit, index) => (
                                <li
                                    key={index}
                                    className="rounded-2xl border border-line bg-surface p-4"
                                >
                                    <div className="flex items-center gap-2">
                                        <input
                                            type="text"
                                            value={unit.unit_name}
                                            onChange={(event) =>
                                                handleUnitChange(
                                                    index,
                                                    "unit_name",
                                                    event.target.value
                                                )
                                            }
                                            disabled={saving}
                                            aria-label="ناوی یەکە"
                                            placeholder="ناوی یەکە"
                                            className="w-full rounded-xl border border-line bg-surface-2 px-3 py-2.5 font-semibold text-ink"
                                        />

                                        <button
                                            type="button"
                                            onClick={() =>
                                                handleRemoveUnit(index)
                                            }
                                            disabled={
                                                saving ||
                                                formData.units.length === 1
                                            }
                                            aria-label="لابردنی یەکە"
                                            className="grid size-10 shrink-0 place-items-center rounded-lg text-muted hover:bg-danger-soft hover:text-danger disabled:opacity-30"
                                        >
                                            <Icon
                                                name="trash"
                                                className="size-4.5"
                                            />
                                        </button>
                                    </div>

                                    <div className="mt-2 flex flex-wrap gap-1.5">
                                        {unitSuggestions.map((suggestion) => (
                                            <button
                                                key={suggestion}
                                                type="button"
                                                onClick={() =>
                                                    handleUnitChange(
                                                        index,
                                                        "unit_name",
                                                        suggestion
                                                    )
                                                }
                                                className={`rounded-full border px-2.5 py-0.5 text-xs ${
                                                    unit.unit_name ===
                                                    suggestion
                                                        ? "border-brand bg-brand text-brand-ink"
                                                        : "border-line text-muted hover:border-brand"
                                                }`}
                                            >
                                                {suggestion}
                                            </button>
                                        ))}
                                    </div>

                                    <label className="mt-4 block">
                                        <span className="mb-1 block text-xs text-muted">
                                            نرخ بە دۆلار ($)
                                        </span>

                                        <input
                                            type="text"
                                            inputMode="decimal"
                                            dir="ltr"
                                            value={unit.price_usd}
                                            onChange={(event) =>
                                                handleUnitChange(
                                                    index,
                                                    "price_usd",
                                                    event.target.value
                                                )
                                            }
                                            disabled={saving}
                                            placeholder="0"
                                            className="w-full rounded-xl border border-line bg-surface px-3 py-2.5 text-center font-semibold text-ink"
                                        />
                                    </label>

                                    <label className="mt-3 block">
                                        <span className="mb-1 block text-xs text-muted">
                                            ستۆک (ئەگەر بەتاڵ بێت، ستۆکی ئەم یەکەیە تۆمار ناکرێت)
                                        </span>

                                        <input
                                            type="text"
                                            inputMode="decimal"
                                            dir="ltr"
                                            value={unit.stock_quantity}
                                            onChange={(event) =>
                                                handleUnitChange(
                                                    index,
                                                    "stock_quantity",
                                                    event.target.value
                                                )
                                            }
                                            disabled={saving}
                                            placeholder="—"
                                            className="w-full rounded-xl border border-line bg-surface px-3 py-2.5 text-center font-semibold text-ink"
                                        />
                                    </label>
                                </li>
                            ))}
                        </ul>

                        <button
                            type="button"
                            onClick={handleAddUnit}
                            disabled={saving}
                            className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-line py-3 font-medium text-muted hover:border-brand hover:text-brand"
                        >
                            <Icon name="plus" className="size-4.5" />
                            یەکەیەکی تر (بۆ نموونە بۆکس، کارتۆن)
                        </button>
                    </div>
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

export default ProductDrawer;
