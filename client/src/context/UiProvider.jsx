import { useCallback, useMemo, useState } from "react";
import { UiContext } from "./uiContext";
import ToastStack from "../components/ToastStack";
import ConfirmDialog from "../components/ConfirmDialog";

function UiProvider({ children }) {
    const [toasts, setToasts] = useState([]);
    const [dialog, setDialog] = useState(null);

    const toast = useCallback((message, type = "info") => {
        const id = `${Date.now()}-${Math.random()}`;

        setToasts((currentToasts) => [
            ...currentToasts,
            { id, message, type }
        ]);

        setTimeout(() => {
            setToasts((currentToasts) =>
                currentToasts.filter((item) => item.id !== id)
            );
        }, 3800);
    }, []);

    // Resolves to true (confirmed) or false (cancelled)
    const confirm = useCallback(
        (message, options = {}) =>
            new Promise((resolve) => {
                setDialog({ message, ...options, resolve });
            }),
        []
    );

    const closeDialog = (result) => {
        dialog.resolve(result);
        setDialog(null);
    };

    const value = useMemo(() => ({ toast, confirm }), [toast, confirm]);

    return (
        <UiContext.Provider value={value}>
            {children}

            <ToastStack toasts={toasts} />

            {dialog && (
                <ConfirmDialog
                    title={dialog.title}
                    message={dialog.message}
                    confirmLabel={dialog.confirmLabel}
                    danger={dialog.danger}
                    onConfirm={() => closeDialog(true)}
                    onCancel={() => closeDialog(false)}
                />
            )}
        </UiContext.Provider>
    );
}

export default UiProvider;
