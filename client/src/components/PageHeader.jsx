function PageHeader({ title, subtitle, children }) {
    return (
        <header className="mb-7 flex flex-wrap items-end justify-between gap-4">
            <div>
                <h1 className="font-display text-3xl font-extrabold text-ink">
                    {title}
                </h1>

                {subtitle && (
                    <p className="mt-1.5 max-w-xl text-muted">{subtitle}</p>
                )}
            </div>

            {children}
        </header>
    );
}

export default PageHeader;
