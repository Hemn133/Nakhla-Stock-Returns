// Every number, date and phone number is shown with normal digits (0-9).
// Intl is always told to use the "latn" numbering system, so a browser or
// computer set to Arabic can never turn the digits into ٠١٢٣.

const IRAQ_TIME_ZONE = "Asia/Baghdad";
const ONE_DAY = 24 * 60 * 60 * 1000;


// ---------- Showing numbers ----------

// Kept as small functions so every page uses the same path
export const localizeDigits = (text) => String(text);

export const localizeNumber = (text) => String(text);

// A number written inside an input box (no thousands separators)
export const numberToInput = (number) => String(number);

// 25 -> "25", 10.5 -> "10.5", 1234.5 -> "1,234.5" (no useless trailing zeros)
export const formatNumber = (value, maxDecimals = 2) => {
    const number = Number(value);

    if (!Number.isFinite(number)) {
        return "";
    }

    return number.toLocaleString("en-US", {
        useGrouping: true,
        minimumFractionDigits: 0,
        maximumFractionDigits: maxDecimals,
        numberingSystem: "latn"
    });
};

// All money is USD:  $25   $10.5   $3.25
export const formatMoney = (amount) => {
    const number = Number(amount) || 0;

    return `${number < 0 ? "-" : ""}$${formatNumber(Math.abs(number), 2)}`;
};

// Date and time in Iraq time, for example 14/10/2026 15:30
export const formatDate = (value) =>
    new Intl.DateTimeFormat("en-GB", {
        timeZone: IRAQ_TIME_ZONE,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        hourCycle: "h23",
        numberingSystem: "latn"
    })
        .format(new Date(value))
        .replace(",", "");

// "2026-10-14"  ->  2026/10/14
export const formatDay = (value) => String(value).replaceAll("-", "/");


// ---------- Reading numbers ----------

// Arabic-Indic (٠-٩) and Persian (۰-۹) digits  ->  0-9.
// Used when someone types, so the input box always shows normal digits.
export const toEnglishDigits = (text) =>
    String(text)
        .replace(/[\u0660-\u0669]/g, (digit) =>
            String(digit.charCodeAt(0) - 0x0660)
        )
        .replace(/[\u06F0-\u06F9]/g, (digit) =>
            String(digit.charCodeAt(0) - 0x06f0)
        );

// Reads a number typed with any kind of digits: "١٬٢٣٤٫٥" -> 1234.5
// Returns null when the text is not a number.
export const parseNumber = (value) => {
    if (value === null || value === undefined) {
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

// A money amount is valid with at most two decimals
export const hasMaxTwoDecimals = (amount) =>
    Math.abs(amount * 100 - Math.round(amount * 100)) < 1e-6;

// "2026-10-14" -> true. Rejects 2026-02-31.
export const isValidDateString = (value) => {
    if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
        return false;
    }

    const date = new Date(`${value}T00:00:00Z`);

    return (
        !Number.isNaN(date.getTime()) &&
        date.toISOString().slice(0, 10) === value
    );
};


// ---------- Searching text ----------

// Same rules as normalize_text() in the database:
// Arabic ي ك and Kurdish ی ک are the same letter, diacritics are ignored,
// Arabic digits become 0-9.
export const normalizeText = (text) =>
    toEnglishDigits(text || "")
        .replace(/[\u064A\u0649]/g, "\u06CC")
        .replace(/\u0643/g, "\u06A9")
        .replace(/\u06BE/g, "\u0647")
        .replace(/[\u0623\u0625\u0622\u0671]/g, "\u0627")
        .replace(/\u0629/g, "\u0647")
        .replace(/[\u064B-\u065F\u0670\u0640\u200B-\u200F\u202A-\u202E]/g, "")
        .replace(/\s+/g, " ")
        .trim()
        .toLowerCase();


// ---------- Days (Iraq time) ----------

// "2026-10-14" (the same format the reports and statements use)
export const getDayKey = (value = Date.now()) =>
    new Intl.DateTimeFormat("en-CA", {
        timeZone: IRAQ_TIME_ZONE,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        numberingSystem: "latn"
    }).format(new Date(value));

// The last "count" days, oldest first
export const getLastDayKeys = (count) =>
    Array.from({ length: count }, (item, index) =>
        getDayKey(Date.now() - (count - 1 - index) * ONE_DAY)
    );

// ئەمڕۆ / دوێنێ / 2026/10/12
export const getDayLabel = (dayKey) => {
    if (dayKey === getDayKey()) {
        return "ئەمڕۆ";
    }

    if (dayKey === getDayKey(Date.now() - ONE_DAY)) {
        return "دوێنێ";
    }

    return formatDay(dayKey);
};

// Time only, for example 15:30
export const formatTime = (value) =>
    new Intl.DateTimeFormat("en-GB", {
        timeZone: IRAQ_TIME_ZONE,
        hour: "2-digit",
        minute: "2-digit",
        hourCycle: "h23",
        numberingSystem: "latn"
    }).format(new Date(value));

// Long date in Kurdish when the browser knows it, otherwise in Arabic:
// چوارشەممە 14 تشرینی یەکەم 2026
export const formatDateLong = (value = Date.now()) => {
    const locale = ["ckb-IQ", "ckb", "ar-IQ"].find(
        (name) => Intl.DateTimeFormat.supportedLocalesOf([name]).length > 0
    );

    if (!locale) {
        return formatDate(value);
    }

    const parts = {};

    new Intl.DateTimeFormat(locale, {
        timeZone: IRAQ_TIME_ZONE,
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric",
        numberingSystem: "latn"
    })
        .formatToParts(new Date(value))
        .forEach((part) => {
            parts[part.type] = part.value;
        });

    // toEnglishDigits is a second guard in case a browser ignores numberingSystem
    return toEnglishDigits(
        `${parts.weekday} ${parts.day} ${parts.month} ${parts.year}`
    );
};
