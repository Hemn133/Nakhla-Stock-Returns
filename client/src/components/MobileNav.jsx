import { useLocation } from "react-router-dom";
import { navItems } from "../navigation";
import useGuardedNavigate from "../hooks/useGuardedNavigate";
import Icon from "./Icon";

// Tab bar at the bottom of the screen (phones and tablets)
function MobileNav({ cart }) {
    const location = useLocation();
    const go = useGuardedNavigate(cart);

    return (
        <nav
            style={{ gridTemplateColumns: `repeat(${navItems.length}, minmax(0, 1fr))` }}
            className="fixed inset-x-0 bottom-0 z-30 grid border-t border-line bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur print:hidden lg:hidden">
            {navItems.map((item) => {
                const active = location.pathname === item.path;

                return (
                    <button
                        key={item.path}
                        onClick={() => go(item.path)}
                        aria-current={active ? "page" : undefined}
                        className={`relative flex flex-col items-center gap-1 px-1 pb-2 pt-2.5 text-[10.5px] font-medium ${
                            active ? "text-brand" : "text-muted"
                        }`}
                    >
                        {active && (
                            <span className="absolute inset-x-5 top-0 h-0.5 rounded-full bg-brand" />
                        )}

                        <Icon name={item.icon} className="size-6" />

                        <span>{item.label}</span>
                    </button>
                );
            })}
        </nav>
    );
}

export default MobileNav;
