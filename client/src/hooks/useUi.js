import { useContext } from "react";
import { UiContext } from "../context/uiContext";

// const { toast, confirm } = useUi();
//   toast("هەڵگیرا", "success")        types: success | error | info
//   if (await confirm("دڵنیایت؟", { danger: true })) { ... }
function useUi() {
    return useContext(UiContext);
}

export default useUi;
