// Numbers and dates typed by people can contain Arabic-Indic (٠-٩) or Persian (۰-۹)
// digits. These helpers turn them into normal values before they are used.

const toEnglishDigits = (value) =>
    String(value)
        .replace(/[\u0660-\u0669]/g, (digit) =>
            String(digit.charCodeAt(0) - 0x0660)
        )
        .replace(/[\u06F0-\u06F9]/g, (digit) =>
            String(digit.charCodeAt(0) - 0x06f0)
        );

// Returns a number, or null when the value is not a number.
// Accepts 12, "12.5", "١٢٫٥", "1,250".
const parseAmount = (value) => {
    if (typeof value === "number") {
        return Number.isFinite(value) ? value : null;
    }

    if (typeof value !== "string") {
        return null;
    }

    const cleaned = toEnglishDigits(value)
        .replace(/\u066B/g, ".")
        .replace(/[\u066C,\s]/g, "");

    if (!/^-?\d+(\.\d+)?$/.test(cleaned)) {
        return null;
    }

    return Number(cleaned);
};

// Money is handled in whole cents so there are no floating point errors.
const toCents = (amount) => Math.round(amount * 100);

const fromCents = (cents) => cents / 100;

// A money amount must not have more than two decimals
const hasMaxTwoDecimals = (amount) =>
    Math.abs(amount * 100 - Math.round(amount * 100)) < 1e-6;

// "2026-10-14" -> true. Rejects 2026-02-31.
const isValidDateString = (value) => {
    if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
        return false;
    }

    const date = new Date(`${value}T00:00:00Z`);

    return (
        !Number.isNaN(date.getTime()) &&
        date.toISOString().slice(0, 10) === value
    );
};

// Today in Iraq time, "2026-10-14"
const getTodayInIraq = () =>
    new Intl.DateTimeFormat("en-CA", {
        timeZone: "Asia/Baghdad",
        year: "numeric",
        month: "2-digit",
        day: "2-digit"
    }).format(new Date());

module.exports = {
    toEnglishDigits,
    parseAmount,
    toCents,
    fromCents,
    hasMaxTwoDecimals,
    isValidDateString,
    getTodayInIraq
};
