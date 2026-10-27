import { isValidDateString, toEnglishDigits } from "../utils/format";

// A date box that always shows normal digits: 2026-10-14
// (the browser's own date picker uses the digits of the computer's language)
function DateInput({ value, onChange, label, disabled }) {
    const handleChange = (event) => {
        // only digits and "-", Arabic digits become 0-9
        const cleaned = toEnglishDigits(event.target.value).replace(
            /[^0-9-]/g,
            ""
        );

        onChange(cleaned.slice(0, 10));
    };

    const isInvalid = value !== "" && !isValidDateString(value);

    return (
        <label className="block">
            <span className="mb-1 block text-xs text-muted">{label}</span>

            <input
                type="text"
                inputMode="numeric"
                dir="ltr"
                value={value}
                onChange={handleChange}
                disabled={disabled}
                placeholder="2026-10-14"
                maxLength={10}
                aria-invalid={isInvalid}
                className={`w-full rounded-xl border bg-surface-2 px-3 py-2.5 text-center font-semibold text-ink ${
                    isInvalid ? "border-danger" : "border-line"
                }`}
            />
        </label>
    );
}

export default DateInput;
