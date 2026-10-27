// A row of options where one is selected (for example نەقد | قەرز)
function Segmented({ options, value, onChange, label, disabled }) {
    return (
        <div
            role="group"
            aria-label={label}
            className="inline-grid auto-cols-fr grid-flow-col gap-1 rounded-2xl border border-line bg-surface-2 p-1"
        >
            {options.map((option) => {
                const selected = option.value === value;

                return (
                    <button
                        key={option.value}
                        onClick={() => onChange(option.value)}
                        disabled={disabled}
                        aria-pressed={selected}
                        className={`rounded-xl px-5 py-2 text-sm font-semibold transition-colors disabled:cursor-not-allowed ${
                            selected
                                ? "bg-brand text-brand-ink shadow-sm"
                                : "text-muted hover:text-ink"
                        }`}
                    >
                        {option.label}
                    </button>
                );
            })}
        </div>
    );
}

export default Segmented;
