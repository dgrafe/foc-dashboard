import { t, localeTag } from "./i18n.js";
import { MAX_UINT256, EPOCH_SECONDS, EPOCHS_PER_DAY, EPOCHS_PER_HOUR, LARGE_DOWNLOAD_BYTES } from "./limits.js";

// Locale-aware decimal separator for manually assembled decimal strings.
const decimalSeparators = new Map();
function decimalSeparator() {
    const tag = localeTag();
    if (!decimalSeparators.has(tag)) {
        const part = new Intl.NumberFormat(tag).formatToParts(1.1).find((entry) => entry.type === "decimal");
        decimalSeparators.set(tag, part ? part.value : ".");
    }
    return decimalSeparators.get(tag);
}

// Intl.NumberFormat construction is expensive, so formatters are cached per locale and digit count.
const numberFormatters = new Map();
function numberFormatter(minimumFractionDigits, maximumFractionDigits) {
    const tag = localeTag();
    const key = `${tag}|${minimumFractionDigits}|${maximumFractionDigits}`;
    let formatter = numberFormatters.get(key);
    if (!formatter) {
        formatter = new Intl.NumberFormat(tag, { minimumFractionDigits, maximumFractionDigits });
        numberFormatters.set(key, formatter);
    }
    return formatter;
}

export function formatBytes(size) {
    const units = ["B", "KiB", "MiB", "GiB", "TiB", "PiB"];
    let value = Number(size);
    let unit = 0;
    while (value >= 1024 && unit < units.length - 1) {
        value /= 1024;
        unit++;
    }
    const digits = unit === 0 ? 0 : 2;
    return `${numberFormatter(digits, digits).format(value)} ${units[unit]}`;
}

// Download warnings are only worth showing for pieces that are genuinely large.
export function isLargeDownload(size) {
    return size !== null && size >= LARGE_DOWNLOAD_BYTES;
}

export function formatUnits(value, decimals, maxFractionDigits = 4) {
    const scale = 10n ** BigInt(decimals);
    const integer = (value / scale).toLocaleString(localeTag());
    const fraction = (value % scale).toString().padStart(decimals, "0").slice(0, maxFractionDigits).replace(/0+$/, "");
    return fraction ? `${integer}${decimalSeparator()}${fraction}` : integer;
}

export function formatUnitsFixed(value, decimals, fractionDigits = 4) {
    const scale = 10n ** BigInt(decimals);
    const displayScale = 10n ** BigInt(fractionDigits);
    const rounded = (value * displayScale + scale / 2n) / scale;
    const integer = (rounded / displayScale).toLocaleString(localeTag());
    const fraction = (rounded % displayScale).toString().padStart(fractionDigits, "0");
    return `${integer}${decimalSeparator()}${fraction}`;
}

export function formatUnitsRounded(value, decimals, maxFractionDigits = 4) {
    const precision = 10n ** BigInt(Math.max(0, decimals - maxFractionDigits));
    const rounded = ((value + precision / 2n) / precision) * precision;
    return formatUnits(rounded, decimals, maxFractionDigits);
}

export function formatStorageHorizon(epochs, ratePerEpoch, debt = 0n, isRunway = true) {
    if (ratePerEpoch === 0n || epochs >= MAX_UINT256) return t("format.noStorageSpend");
    if (isRunway && debt > 0n) return t("format.inDeficit");
    if (epochs === 0n) return isRunway ? t("format.zeroRunway") : t("format.zeroDays");
    if (epochs > BigInt(Number.MAX_SAFE_INTEGER)) return t("format.veryLongRunway");

    const days = epochs / EPOCHS_PER_DAY;
    const hours = (epochs % EPOCHS_PER_DAY) / EPOCHS_PER_HOUR;
        let duration;
        if (days === 0n) {
            duration = hours === 1n
                ? t("format.durationHoursOne", { hours })
                : t("format.durationHours", { hours });
        } else {
            duration = days === 1n
                ? t("format.durationDaysOne", { days, hours })
                : t("format.durationDays", { days, hours });
        }
    const estimatedEnd = new Date(Date.now() + Number(epochs) * EPOCH_SECONDS * 1000);
    const date = new Intl.DateTimeFormat(localeTag(), { dateStyle: "medium" }).format(estimatedEnd);
    return `${duration} · ${t("format.untilApprox", { date })}`;
}
