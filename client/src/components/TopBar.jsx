import { SHOP_NAME } from "../config";
import useTheme from "../hooks/useTheme";
import { formatDateLong } from "../utils/format";
import Icon from "./Icon";
import PalmLogo from "./PalmLogo";

function TopBar() {
    const { theme, toggleTheme } = useTheme();

    return (
        <div className="sticky top-0 z-20 border-b border-line bg-bg/85 backdrop-blur print:hidden">
            <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
                <div className="flex min-w-0 items-center gap-2 lg:hidden">
                    <PalmLogo className="size-8 shrink-0 text-brand" />

                    <span className="truncate font-display font-extrabold text-ink">
                        {SHOP_NAME}
                    </span>
                </div>

                <p className="hidden text-sm text-muted lg:block">
                    {formatDateLong()}
                </p>

                <button
                    onClick={toggleTheme}
                    aria-label={
                        theme === "dark" ? "ڕووکاری ڕووناک" : "ڕووکاری تاریک"
                    }
                    className="grid size-10 shrink-0 place-items-center rounded-full border border-line bg-surface text-ink hover:border-gold"
                >
                    <Icon
                        name={theme === "dark" ? "sun" : "moon"}
                        className="size-5"
                    />
                </button>
            </div>
        </div>
    );
}

export default TopBar;
