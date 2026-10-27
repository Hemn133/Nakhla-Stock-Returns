import { useEffect } from "react";
import { createPortal } from "react-dom";
import { getReturnStatus } from "../utils/returns";
import Icon from "./Icon";
import Receipt from "./Receipt";

// Shows a wasl on top of the page with print, return and (optional) delete buttons.
// onReturn is only given where returns are allowed; the button disappears
// when the whole wasl has already been returned.
function ReceiptModal({
    wasl,
    items,
    returns = [],
    onClose,
    onDelete,
    onReturn,
    closeOnEscape = true
}) {
    useEffect(() => {
        if (!closeOnEscape) {
            return undefined;
        }

        const handleKeyDown = (event) => {
            if (event.key === "Escape") {
                onClose();
            }
        };

        window.addEventListener("keydown", handleKeyDown);

        return () => {
            window.removeEventListener("keydown", handleKeyDown);
        };
    }, [onClose, closeOnEscape]);

    const canReturn = onReturn && getReturnStatus(items) !== "full";

    // Rendered outside #root so printing can hide the whole app
    return createPortal(
        <div
            className="fixed inset-0 z-[60] overflow-y-auto bg-black/60 p-4 backdrop-blur-sm animate-fade print:static print:overflow-visible print:bg-transparent print:p-0 print:backdrop-blur-none"
            onClick={onClose}
        >
            <div
                className="mx-auto my-6 w-full max-w-sm print:my-0 print:max-w-none"
                onClick={(event) => event.stopPropagation()}
            >
                <div className="drop-shadow-2xl print:drop-shadow-none">
                    <Receipt wasl={wasl} items={items} returns={returns} />
                </div>

                <div className="mt-5 flex flex-wrap gap-3 print:hidden">
                    <button
                        onClick={() => window.print()}
                        className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-gold px-4 py-3 font-bold text-gold-ink hover:opacity-90"
                    >
                        <Icon name="printer" className="size-5" />
                        چاپکردن
                    </button>

                    {canReturn && (
                        <button
                            onClick={onReturn}
                            className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-brand px-4 py-3 font-bold text-brand-ink hover:opacity-90"
                        >
                            <Icon name="undo" className="size-5" />
                            گەڕاندنەوەی کاڵا
                        </button>
                    )}

                    {onDelete && (
                        <button
                            onClick={onDelete}
                            className="flex items-center justify-center gap-2 rounded-xl border border-white/30 bg-black/30 px-4 py-3 font-semibold text-white hover:bg-danger"
                        >
                            <Icon name="trash" className="size-5" />
                            سڕینەوە
                        </button>
                    )}

                    <button
                        onClick={onClose}
                        className="flex items-center justify-center gap-2 rounded-xl border border-white/30 bg-black/30 px-4 py-3 font-semibold text-white hover:bg-white/20"
                    >
                        داخستن
                    </button>
                </div>
            </div>
        </div>,
        document.body
    );
}

export default ReceiptModal;
