import { useLocation } from "react-router-dom";
import { navItems } from "../navigation";
import useGuardedNavigate from "../hooks/useGuardedNavigate";
import { SHOP_NAME, SHOP_TAGLINE } from "../config";
import { formatNumber } from "../utils/format";
import Icon from "./Icon";
import PalmLogo from "./PalmLogo";

// Dark green side menu (large screens)
function Sidebar({ cart }) {
    const location = useLocation();
    const go = useGuardedNavigate(cart);

    return (
        <aside className="fixed inset-y-0 start-0 z-30 hidden w-64 flex-col bg-side text-side-ink print:hidden lg:flex">
            <button
                onClick={() => go("/dashboard")}
                className="flex items-center gap-3 px-6 py-7 text-start"
            >
                <PalmLogo className="size-12 shrink-0 text-gold" />

                <span>
                    <span className="block font-display text-xl font-extrabold leading-tight">
                        {SHOP_NAME}
                    </span>

                    <span className="block text-sm text-side-muted">
                        {SHOP_TAGLINE}
                    </span>
                </span>
            </button>

            <nav className="mt-2 flex flex-1 flex-col gap-1 px-3">
                {navItems.map((item) => {
                    const active = location.pathname === item.path;

                    return (
                        <button
                            key={item.path}
                            onClick={() => go(item.path)}
                            aria-current={active ? "page" : undefined}
                            className={`relative flex items-center gap-3 rounded-xl px-4 py-3 text-start transition-colors ${
                                active
                                    ? "bg-white/10 font-semibold text-white"
                                    : "text-side-muted hover:bg-white/5 hover:text-white"
                            }`}
                        >
                            {active && (
                                <span className="absolute inset-y-2.5 start-0 w-1 rounded-full bg-gold" />
                            )}

                            <Icon name={item.icon} />

                            <span className="flex-1">{item.label}</span>

                            {item.path === "/pos" && cart.length > 0 && (
                                <span className="grid min-w-6 place-items-center rounded-full bg-gold px-1.5 text-xs font-bold text-gold-ink">
                                    {formatNumber(cart.length)}
                                </span>
                            )}
                        </button>
                    );
                })}
            </nav>
        </aside>
    );
}

export default Sidebar;
