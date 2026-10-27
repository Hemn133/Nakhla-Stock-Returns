import { SHOP_NAME } from "../config";
import {
    formatDate,
    formatMoney,
    formatNumber,
    localizeDigits
} from "../utils/format";
import {
    FULL_RETURN_LABEL,
    PARTIAL_RETURN_LABEL,
    RETURNED_LABEL,
    getReturnStatus,
    sumReturns
} from "../utils/returns";
import PalmLogo from "./PalmLogo";

// The wasl as a paper slip (all amounts are USD).
// It shows which products were returned, from the real returned quantities.
function Receipt({ wasl, items, returns = [] }) {
    const receiptNumber = localizeDigits(
        String(wasl.wasl_id).padStart(4, "0")
    );

    const returnStatus = getReturnStatus(items);
    const returned = sumReturns(returns);

    return (
        <div
            id="print-area"
            className="receipt-paper animate-print bg-white px-6 pb-10 pt-10 text-neutral-900"
        >
            <div className="text-center">
                <PalmLogo className="mx-auto size-10 text-emerald-800" />

                <h3 className="mt-2 font-display text-2xl font-extrabold">
                    {SHOP_NAME}
                </h3>
            </div>

            <div className="mt-5 flex items-center justify-between border-y border-dashed border-neutral-400 py-2.5 text-sm">
                <span className="font-semibold">
                    وەسڵی ژمارە {receiptNumber}
                </span>

                <span className="text-neutral-600">
                    {formatDate(wasl.created_at)}
                </span>
            </div>

            {returnStatus === "full" && (
                <p className="mt-3 rounded border-2 border-neutral-900 px-3 py-2 text-center font-extrabold">
                    {FULL_RETURN_LABEL}
                </p>
            )}

            {returnStatus === "partial" && (
                <p className="mt-3 rounded border-2 border-dashed border-neutral-900 px-3 py-2 text-center font-bold">
                    {PARTIAL_RETURN_LABEL}
                </p>
            )}

            {wasl.sale_type === "credit" && (
                <p className="mt-3 inline-block rounded border border-neutral-700 px-2 py-0.5 text-xs font-bold">
                    فرۆشتن بە قەرز
                </p>
            )}

            {wasl.customer_name && (
                <p className="mt-3 text-sm text-neutral-600">
                    کڕیار:{" "}
                    <span className="font-semibold text-neutral-900">
                        {wasl.customer_name}
                    </span>
                </p>
            )}

            <table className="mt-4 w-full text-sm">
                <thead>
                    <tr className="text-neutral-500">
                        <th className="pb-2 text-start font-medium">کاڵا</th>
                        <th className="pb-2 text-start font-medium">بڕ</th>
                        <th className="pb-2 text-start font-medium">نرخ</th>
                        <th className="pb-2 text-end font-medium">کۆ</th>
                    </tr>
                </thead>

                <tbody>
                    {items.map((item) => {
                        const returnedQuantity = Number(item.returned_quantity);
                        const isFullyReturned =
                            returnedQuantity >= Number(item.quantity);

                        return (
                            <tr
                                key={item.wasl_item_id}
                                className="border-t border-dotted border-neutral-300 align-top"
                            >
                                <td className="py-2.5 pe-2 font-medium">
                                    {item.product_name}

                                    {item.unit_name && (
                                        <span className="block text-xs font-normal text-neutral-500">
                                            {item.unit_name}
                                        </span>
                                    )}

                                    {returnedQuantity > 0 && (
                                        <span className="mt-1 block text-xs font-bold">
                                            <span className="rounded border border-neutral-900 px-1.5 py-0.5">
                                                {RETURNED_LABEL}
                                            </span>{" "}
                                            × {formatNumber(returnedQuantity, 3)}
                                            {!isFullyReturned && (
                                                <span className="font-normal text-neutral-600">
                                                    {" "}
                                                    (لای کڕیار ماوە:{" "}
                                                    {formatNumber(
                                                        Number(item.quantity) -
                                                            returnedQuantity,
                                                        3
                                                    )}
                                                    )
                                                </span>
                                            )}
                                        </span>
                                    )}
                                </td>

                                <td className="py-2.5 pe-2">
                                    {formatNumber(item.quantity, 3)}
                                </td>

                                <td className="py-2.5 pe-2">
                                    {formatMoney(item.unit_price)}
                                </td>

                                <td className="py-2.5 text-end font-semibold">
                                    {formatMoney(item.subtotal)}
                                </td>
                            </tr>
                        );
                    })}
                </tbody>
            </table>

            <div className="mt-3 space-y-1.5 border-t border-dashed border-neutral-400 pt-3 text-sm">
                <div className="flex items-center justify-between text-neutral-600">
                    <span>کۆی بچووک</span>

                    <span>{formatMoney(wasl.subtotal)}</span>
                </div>

                {Number(wasl.discount) > 0 && (
                    <div className="flex items-center justify-between text-neutral-600">
                        <span>داشکاندن</span>

                        <span>{formatMoney(wasl.discount)}</span>
                    </div>
                )}

                <div className="flex items-baseline justify-between pt-1">
                    <span className="font-semibold">کۆی گشتی</span>

                    <span className="font-display text-2xl font-extrabold">
                        {formatMoney(wasl.total)}
                    </span>
                </div>

                {returned.netCents > 0 && (
                    <>
                        <div className="flex items-center justify-between border-t border-dotted border-neutral-300 pt-2 font-semibold">
                            <span>گەڕاندنەوەی کاڵا</span>

                            <span>-{formatMoney(returned.netCents / 100)}</span>
                        </div>

                        <div className="flex items-center justify-between font-bold">
                            <span>کۆی گشتی دوای گەڕاندنەوە</span>

                            <span>
                                {formatMoney(
                                    Math.round(Number(wasl.total) * 100 - returned.netCents) /
                                        100
                                )}
                            </span>
                        </div>

                        {returned.refundCents > 0 && (
                            <div className="flex items-center justify-between text-neutral-600">
                                <span>پارەی گەڕێنراوە بە نەقد</span>

                                <span>
                                    {formatMoney(returned.refundCents / 100)}
                                </span>
                            </div>
                        )}

                        {returned.debtCents > 0 && (
                            <div className="flex items-center justify-between text-neutral-600">
                                <span>لە قەرزی کڕیار کەمکرایەوە</span>

                                <span>
                                    {formatMoney(returned.debtCents / 100)}
                                </span>
                            </div>
                        )}
                    </>
                )}
            </div>

            <p className="mt-6 text-center text-sm font-medium">
                سوپاس بۆ کڕینتان
            </p>
        </div>
    );
}

export default Receipt;
