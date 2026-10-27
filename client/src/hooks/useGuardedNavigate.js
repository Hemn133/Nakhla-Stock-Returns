import { useLocation, useNavigate } from "react-router-dom";
import useUi from "./useUi";

// Navigation that asks first when leaving the POS with items in the cart
function useGuardedNavigate(cart) {
    const navigate = useNavigate();
    const location = useLocation();
    const { confirm } = useUi();

    return async (path) => {
        if (path === location.pathname) {
            return;
        }

        if (cart.length > 0 && location.pathname === "/pos") {
            const leave = await confirm(
                "کاڵات لە سەبەتەدا هەیە. دڵنیایت دەتەوێت لەم لاپەڕەیە بچیتە دەرەوە؟",
                {
                    title: "سەبەتە بەتاڵ نییە",
                    confirmLabel: "بڕۆ دەرەوە",
                    danger: true
                }
            );

            if (!leave) {
                return;
            }
        }

        navigate(path);
    };
}

export default useGuardedNavigate;
