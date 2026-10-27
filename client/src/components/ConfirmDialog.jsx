import { useEffect, useRef } from "react";

function ConfirmDialog({
    title,
    message,
    confirmLabel,
    danger,
    onConfirm,
    onCancel
}) {
    const cancelRef = useRef(null);

    useEffect(() => {
        // The safe choice is focused first
        cancelRef.current?.focus();

        const handleKeyDown = (event) => {
            if (event.key === "Escape") {
                onCancel();
            }
        };

        window.addEventListener("keydown", handleKeyDown);

        return () => {
            window.removeEventListener("keydown", handleKeyDown);
        };
    }, [onCancel]);

    return (
        <div
            className="fixed inset-0 z-[90] grid place-items-center bg-black/55 p-4 backdrop-blur-sm animate-fade print:hidden"
            onClick={onCancel}
        >
            <div
                role="alertdialog"
                aria-modal="true"
                className="w-full max-w-sm rounded-3xl bg-surface p-6 shadow-card"
                onClick={(event) => event.stopPropagation()}
            >
                <h3 className="font-display text-xl font-bold text-ink">
                    {title || "دڵنیایت؟"}
                </h3>

                <p className="mt-2 leading-7 text-muted">{message}</p>

                <div className="mt-6 flex gap-3">
                    <button
                        onClick={onConfirm}
                        className={`flex-1 rounded-xl px-4 py-3 font-semibold ${
                            danger
                                ? "bg-danger text-white hover:opacity-90"
                                : "bg-brand text-brand-ink hover:opacity-90"
                        }`}
                    >
                        {confirmLabel || "بەڵێ"}
                    </button>

                    <button
                        ref={cancelRef}
                        onClick={onCancel}
                        className="flex-1 rounded-xl border border-line bg-surface-2 px-4 py-3 font-semibold text-ink hover:bg-brand-soft"
                    >
                        نەخێر
                    </button>
                </div>
            </div>
        </div>
    );
}

export default ConfirmDialog;
