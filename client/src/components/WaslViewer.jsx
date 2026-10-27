import { useCallback, useEffect, useRef, useState } from "react";
import { API_URL } from "../config";
import useUi from "../hooks/useUi";
import ReceiptModal from "./ReceiptModal";
import ReturnDialog from "./ReturnDialog";

// Opens a saved wasl: the receipt (with its return statuses), the print button
// and the product return. It reads the wasl again after every return, so the
// screen always shows what is really saved.
//   onChanged : called after a return, so the page behind can refresh its list
//   onDelete  : optional, shows the delete button (gets the wasl)
function WaslViewer({ waslId, onClose, onChanged, onDelete }) {
    const { toast } = useUi();

    const [detail, setDetail] = useState(null);
    const [returnOpen, setReturnOpen] = useState(false);

    // The parent passes a new onClose on every render. Keeping it in a ref stops
    // the wasl from being read again each time the page behind refreshes.
    const onCloseRef = useRef(onClose);

    useEffect(() => {
        onCloseRef.current = onClose;
    });

    const fetchDetail = useCallback(async () => {
        try {
            const response = await fetch(`${API_URL}/wasls/${waslId}`);

            const data = await response.json();

            if (!response.ok) {
                toast("نەتوانرا وەسڵ باربکرێت.", "error");
                onCloseRef.current();
                return;
            }

            setDetail(data);
        } catch (error) {
            console.error("Error fetching wasl details:", error);

            toast("هەڵەیەک ڕوویدا لە کاتی بارکردنی وەسڵ.", "error");
            onCloseRef.current();
        }
    }, [waslId, toast]);

    useEffect(() => {
        fetchDetail();
    }, [fetchDetail]);

    const handleReturnDone = async () => {
        setReturnOpen(false);

        await fetchDetail();

        if (onChanged) {
            onChanged();
        }
    };

    if (!detail) {
        return null;
    }

    return (
        <>
            <ReceiptModal
                wasl={detail.wasl}
                items={detail.items}
                returns={detail.returns}
                onClose={onClose}
                onReturn={() => setReturnOpen(true)}
                onDelete={onDelete ? () => onDelete(detail.wasl) : undefined}
                closeOnEscape={!returnOpen}
            />

            {returnOpen && (
                <ReturnDialog
                    wasl={detail.wasl}
                    items={detail.items}
                    returns={detail.returns}
                    onClose={() => setReturnOpen(false)}
                    onDone={handleReturnDone}
                />
            )}
        </>
    );
}

export default WaslViewer;
