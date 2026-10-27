// Simple bar chart. data: [{ key, label, title, value }]
function BarChart({ data, highlightKey }) {
    const maxValue = Math.max(...data.map((item) => item.value), 0);

    return (
        <div className="flex h-56 items-end gap-1.5 sm:gap-2" dir="rtl">
            {data.map((item) => {
                const percent =
                    maxValue > 0 ? (item.value / maxValue) * 100 : 0;

                const isHighlighted = item.key === highlightKey;

                return (
                    <div
                        key={item.key}
                        className="group flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-2"
                    >
                        <div className="relative flex w-full flex-1 items-end">
                            <div
                                className={`w-full rounded-t-lg transition-colors ${
                                    isHighlighted
                                        ? "bg-gold"
                                        : "bg-brand/75 group-hover:bg-brand"
                                }`}
                                style={{
                                    height: `${item.value > 0 ? Math.max(percent, 3) : 1}%`
                                }}
                            />

                            <span className="pointer-events-none absolute bottom-full start-1/2 z-10 mb-1 hidden -translate-x-1/2 whitespace-nowrap rounded-lg bg-ink px-2.5 py-1 text-xs font-semibold text-bg group-hover:block rtl:translate-x-1/2">
                                {item.title}
                            </span>
                        </div>

                        <span
                            className={`text-xs ${
                                isHighlighted
                                    ? "font-bold text-gold-text"
                                    : "text-muted"
                            }`}
                        >
                            {item.label}
                        </span>
                    </div>
                );
            })}
        </div>
    );
}

export default BarChart;
