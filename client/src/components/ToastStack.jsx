import Icon from "./Icon";

const toastStyles = {
    success: { icon: "check", color: "bg-brand text-brand-ink" },
    error: { icon: "alert", color: "bg-danger text-white" },
    info: { icon: "info", color: "bg-gold text-gold-ink" }
};

function ToastStack({ toasts }) {
    return (
        <div
            className="pointer-events-none fixed inset-x-0 top-4 z-[80] flex flex-col items-center gap-2 px-4 print:hidden"
            aria-live="polite"
        >
            {toasts.map((toast) => {
                const style = toastStyles[toast.type] || toastStyles.info;

                return (
                    <div
                        key={toast.id}
                        className="flex max-w-md animate-toast items-center gap-3 rounded-2xl border border-line bg-surface py-2.5 pe-5 ps-2.5 shadow-card"
                    >
                        <span
                            className={`grid size-8 shrink-0 place-items-center rounded-full ${style.color}`}
                        >
                            <Icon name={style.icon} className="size-4" />
                        </span>

                        <p className="text-sm font-medium text-ink">
                            {toast.message}
                        </p>
                    </div>
                );
            })}
        </div>
    );
}

export default ToastStack;
