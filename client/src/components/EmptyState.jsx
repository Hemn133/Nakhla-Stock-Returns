import PalmLogo from "./PalmLogo";

// An empty screen: says what is missing and what to do next
function EmptyState({ title, description, children }) {
    return (
        <div className="px-6 py-14 text-center">
            <PalmLogo className="mx-auto size-14 text-line" />

            <p className="mt-4 font-display text-lg font-bold text-ink">
                {title}
            </p>

            {description && (
                <p className="mx-auto mt-1.5 max-w-sm text-muted">
                    {description}
                </p>
            )}

            {children && <div className="mt-5">{children}</div>}
        </div>
    );
}

export default EmptyState;
