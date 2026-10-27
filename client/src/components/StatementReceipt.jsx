import {
    SHOP_ADDRESS,
    SHOP_NAME,
    SHOP_PHONES
} from "../config";
import { formatMoney, formatNumber } from "../utils/format";
import { RETURNED_LABEL } from "../utils/returns";
import PalmLogo from "./PalmLogo";

const columns = ["#", "بابەت", "بڕی پارە", "بڕ", "کۆی گشتی", "ژ.م", "بەروار"];

const cellClass = "border border-neutral-900 px-2 py-2 font-bold";

// The combined customer statement (کشف حساب): credit sales and payments
// in one table, laid out like the sample statement.
//   statement = the answer of GET /api/customers/:id/statement
function StatementReceipt({ statement }) {
    const {
        customer,
        period,
        opening_balance,
        total_owed,
        total_paid,
        total_returned,
        remaining,
        rows
    } = statement;

    // A period statement starts with what the customer already owed
    const showOpening = !period.is_complete && Number(opening_balance) !== 0;

    return (
        <div
            id="print-area"
            className="statement-paper bg-white p-6 text-neutral-900 sm:p-8 print:p-0"
        >
            {/* Phones | shop | address */}
            <div className="grid grid-cols-3 items-center gap-4 border-b border-neutral-300 pb-5">
                <div>
                    <p className="text-lg font-extrabold sm:text-xl">
                        ژمارە مۆبایل
                    </p>

                    {SHOP_PHONES.map((phone) => (
                        <p
                            key={phone}
                            dir="ltr"
                            className="text-start text-base font-bold sm:text-lg"
                        >
                            {phone}
                        </p>
                    ))}
                </div>

                <div className="text-center">
                    <PalmLogo className="mx-auto size-12 text-emerald-800" />

                    <p className="mt-1 font-display text-lg font-extrabold">
                        {SHOP_NAME}
                    </p>
                </div>

                <div className="text-center">
                    <p className="text-lg font-extrabold sm:text-xl">
                        ناونیشان
                    </p>

                    <p className="text-sm font-bold">{SHOP_ADDRESS}</p>
                </div>
            </div>

            {/* Totals */}
            <dl className="mt-5 space-y-1 text-lg font-bold">
                <div>
                    کۆی گشتی: <span>{formatMoney(total_owed)}</span>
                </div>

                <div>
                    دراو: <span>{formatMoney(total_paid)}</span>
                </div>

                {Number(total_returned) > 0 && (
                    <div>
                        گەڕاندنەوەی کاڵا: <span>{formatMoney(total_returned)}</span>
                    </div>
                )}

                <div>
                    ماوە: <span>{formatMoney(remaining)}</span>
                </div>
            </dl>

            <h2 className="mt-3 text-center font-display text-3xl font-extrabold text-slate-700">
                کشف حساب
            </h2>

            <p className="mt-3 text-xl font-bold">{customer.name}</p>

            <p className="text-sm text-neutral-600">
                {period.is_complete ? (
                    "هەموو مێژووی حساب"
                ) : (
                    <>
                        لە <span dir="ltr">{period.from}</span> تا{" "}
                        <span dir="ltr">{period.to}</span>
                    </>
                )}
            </p>

            <div className="mt-3 overflow-x-auto print:overflow-visible">
                <table className="w-full border-collapse text-sm">
                    <thead>
                        <tr>
                            {columns.map((column) => (
                                <th
                                    key={column}
                                    className="border border-neutral-900 px-2 py-2 text-start font-normal text-neutral-500"
                                >
                                    {column}
                                </th>
                            ))}
                        </tr>
                    </thead>

                    <tbody>
                        {showOpening && (
                            <tr className="bg-neutral-100">
                                <td className={cellClass} />
                                <td className={cellClass}>قەرزی پێشوو</td>
                                <td className={cellClass} />
                                <td className={cellClass} />
                                <td className={`${cellClass} tabular-nums`}>
                                    {formatNumber(opening_balance)}
                                </td>
                                <td className={cellClass} />
                                <td className={cellClass} />
                            </tr>
                        )}

                        {rows.length === 0 && (
                            <tr>
                                <td
                                    colSpan={columns.length}
                                    className="border border-neutral-900 px-2 py-6 text-center text-neutral-500"
                                >
                                    لەم ماوەیەدا هیچ فرۆشتن و پارە وەرگرتنێک نییە.
                                </td>
                            </tr>
                        )}

                        {rows.map((row, index) => {
                            const number = index + 1;
                            const unitName = row.unit_name
                                ? ` - ${row.unit_name}`
                                : "";

                            // A credit sale of a product
                            if (row.kind === "sale") {
                                return (
                                    <tr key={`sale-${row.row_id}`}>
                                        <td className={cellClass}>{number}</td>

                                        <td className={cellClass}>
                                            {row.title}
                                            {unitName}
                                        </td>

                                        <td className={`${cellClass} tabular-nums`}>
                                            {formatNumber(row.unit_price)}
                                        </td>

                                        <td className={`${cellClass} tabular-nums`}>
                                            {formatNumber(row.quantity, 3)}
                                        </td>

                                        <td className={`${cellClass} tabular-nums`}>
                                            {formatNumber(row.amount)}
                                        </td>

                                        <td className={`${cellClass} tabular-nums`}>
                                            {row.wasl_id}
                                        </td>

                                        <td className={`${cellClass} tabular-nums`}>
                                            {row.row_date}
                                        </td>
                                    </tr>
                                );
                            }

                            // A returned product (lowers the debt)
                            if (row.kind === "return") {
                                return (
                                    <tr
                                        key={`return-${row.row_id}`}
                                        className="bg-amber-100"
                                    >
                                        <td className={cellClass}>{number}</td>

                                        <td className={cellClass}>
                                            {RETURNED_LABEL} - {row.title}
                                            {unitName}
                                        </td>

                                        <td className={`${cellClass} tabular-nums`}>
                                            {formatNumber(row.unit_price)}
                                        </td>

                                        <td className={`${cellClass} tabular-nums`}>
                                            {formatNumber(row.quantity, 3)}
                                        </td>

                                        <td className={`${cellClass} tabular-nums`}>
                                            {formatNumber(row.amount)}
                                        </td>

                                        <td className={`${cellClass} tabular-nums`}>
                                            {row.wasl_id}
                                        </td>

                                        <td className={`${cellClass} tabular-nums`}>
                                            {row.row_date}
                                        </td>
                                    </tr>
                                );
                            }

                            // Part of a return that was paid back in cash
                            // (the customer had already paid it), so it does
                            // not lower the debt
                            if (row.kind === "refund") {
                                return (
                                    <tr
                                        key={`refund-${row.row_id}`}
                                        className="bg-amber-50"
                                    >
                                        <td className={cellClass}>{number}</td>

                                        <td className={cellClass}>
                                            پارەی گەڕێنراوە بە نەقد
                                        </td>

                                        <td className={`${cellClass} tabular-nums`}>
                                            {formatNumber(row.amount)}
                                        </td>

                                        <td className={cellClass} />

                                        <td className={`${cellClass} tabular-nums`}>
                                            {formatNumber(row.amount)}
                                        </td>

                                        <td className={`${cellClass} tabular-nums`}>
                                            {row.wasl_id}
                                        </td>

                                        <td className={`${cellClass} tabular-nums`}>
                                            {row.row_date}
                                        </td>
                                    </tr>
                                );
                            }

                            // Money received from the customer
                            return (
                                <tr
                                    key={`payment-${row.row_id}`}
                                    className="bg-neutral-100"
                                >
                                    <td className={cellClass}>{number}</td>

                                    <td className={cellClass}>
                                        پارە وەرگرتن / {row.note || "-"}
                                    </td>

                                    <td className={`${cellClass} tabular-nums`}>
                                        {formatNumber(row.amount)}
                                    </td>

                                    <td className={cellClass} />

                                    <td className={`${cellClass} tabular-nums`}>
                                        {formatNumber(row.amount)}
                                    </td>

                                    <td className={cellClass} />

                                    <td className={`${cellClass} tabular-nums`}>
                                        {row.row_date}
                                    </td>
                                </tr>
                            );
                        })}

                        <tr>
                            <td className={cellClass} />
                            <td className={cellClass} />
                            <td className={cellClass} />
                            <td className={cellClass} />
                            <td className={cellClass}>
                                ماوە: {formatMoney(remaining)}
                            </td>
                            <td className={cellClass} />
                            <td className={cellClass} />
                        </tr>
                    </tbody>
                </table>
            </div>

            {rows.some((row) => row.kind === "refund") && (
                <p className="mt-3 text-xs text-neutral-600">
                    بڕی گەڕاندنەوە لە قەرز کەمدەکرێتەوە، جگە لەو بڕەی بە نەقد گەڕێنراوەتەوە.
                </p>
            )}
        </div>
    );
}

export default StatementReceipt;
