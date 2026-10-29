import { MAX_UINT256, EPOCH_SECONDS, EPOCHS_PER_DAY, EPOCHS_PER_HOUR, LARGE_DOWNLOAD_BYTES } from "./limits.js";

export function formatBytes(size) {
    const units = ["B", "KiB", "MiB", "GiB", "TiB", "PiB"];
    let value = Number(size);
    let unit = 0;
    while (value >= 1024 && unit < units.length - 1) {
        value /= 1024;
        unit++;
    }
    return `${unit === 0 ? value : value.toFixed(2)} ${units[unit]}`;
}

// Download warnings are only worth showing for pieces that are genuinely large.
export function isLargeDownload(size) {
    return size !== null && size >= LARGE_DOWNLOAD_BYTES;
}

export function formatUnits(value, decimals, maxFractionDigits = 4) {
    const scale = 10n ** BigInt(decimals);
    const integer = (value / scale).toLocaleString("en-US");
    const fraction = (value % scale).toString().padStart(decimals, "0").slice(0, maxFractionDigits).replace(/0+$/, "");
    return fraction ? `${integer}.${fraction}` : integer;
}

export function formatUnitsFixed(value, decimals, fractionDigits = 4) {
    const scale = 10n ** BigInt(decimals);
    const displayScale = 10n ** BigInt(fractionDigits);
    const rounded = (value * displayScale + scale / 2n) / scale;
    const integer = (rounded / displayScale).toLocaleString("en-US");
    const fraction = (rounded % displayScale).toString().padStart(fractionDigits, "0");
    return `${integer}.${fraction}`;
}

export function formatUnitsRounded(value, decimals, maxFractionDigits = 4) {
    const precision = 10n ** BigInt(Math.max(0, decimals - maxFractionDigits));
    const rounded = ((value + precision / 2n) / precision) * precision;
    return formatUnits(rounded, decimals, maxFractionDigits);
}

export function formatStorageHorizon(epochs, ratePerEpoch, debt = 0n, isRunway = true) {
    if (ratePerEpoch === 0n || epochs >= MAX_UINT256) return "No active storage spend";
    if (isRunway && debt > 0n) return "In deficit · top-up required";
    if (epochs === 0n) return isRunway ? "0 days · top-up required" : "0 days";
    if (epochs > BigInt(Number.MAX_SAFE_INTEGER)) return "Very long runway";

    const days = epochs / EPOCHS_PER_DAY;
    const hours = (epochs % EPOCHS_PER_DAY) / EPOCHS_PER_HOUR;
    const duration = days > 0n ? `${days} days ${hours} hr` : `${hours} hr`;
    const estimatedEnd = new Date(Date.now() + Number(epochs) * EPOCH_SECONDS * 1000);
    const date = new Intl.DateTimeFormat("en-US", { dateStyle: "medium" }).format(estimatedEnd);
    return `${duration} · until approx. ${date}`;
}
