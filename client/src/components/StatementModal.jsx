import { useEffect } from "react";
import { createPortal } from "react-dom";
import Icon from "./Icon";
import StatementReceipt from "./StatementReceipt";

// Shows a customer statement on top of the page with a print button.
function StatementModal({ statement, onClose }) {
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

    // Rendered outside #root so printing can hide the whole app
    return createPortal(
        <div
            className="fixed inset-0 z-[60] overflow-y-auto bg-black/60 p-4 backdrop-blur-sm animate-fade print:static print:overflow-visible print:bg-transparent print:p-0 print:backdrop-blur-none"
            onClick={onClose}
        >
            <div
                className="mx-auto my-6 w-full max-w-4xl print:my-0 print:max-w-none"
                onClick={(event) => event.stopPropagation()}
            >
                <div className="overflow-hidden rounded-2xl shadow-2xl print:rounded-none print:shadow-none">
                    <StatementReceipt statement={statement} />
                </div>

                <div className="mt-5 flex flex-wrap gap-3 print:hidden">
                    <button
                        onClick={() => window.print()}
                        className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-gold px-4 py-3 font-bold text-gold-ink hover:opacity-90"
                    >
                        <Icon name="printer" className="size-5" />
                        چاپکردن
                    </button>

                    <button
                        onClick={onClose}
                        className="flex items-center justify-center gap-2 rounded-xl border border-white/30 bg-black/30 px-6 py-3 font-semibold text-white hover:bg-white/20"
                    >
                        داخستن
                    </button>
                </div>
            </div>
        </div>,
        document.body
    );
}

export default StatementModal;
