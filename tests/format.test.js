import test from "node:test";
import assert from "node:assert/strict";
import { setLanguage } from "../js/i18n.js";
import { formatBytes, formatStorageHorizon, formatUnits, formatUnitsFixed, formatUnitsRounded, isLargeDownload } from "../js/format.js";
import { MAX_UINT256, EPOCHS_PER_DAY, EPOCHS_PER_HOUR, EPOCH_SECONDS, LARGE_DOWNLOAD_BYTES } from "../js/limits.js";

// The formatting output is language-dependent; these assertions expect English.
setLanguage("en");

// Mirrors the date part of formatStorageHorizon so the assertions stay time-independent.
const dateLabel = (epochs) => new Intl.DateTimeFormat("en-US", { dateStyle: "medium" })
    .format(new Date(Date.now() + Number(epochs) * EPOCH_SECONDS * 1000));

test("formats byte sizes using binary units", () => {
    assert.equal(formatBytes(0n), "0 B");
    assert.equal(formatBytes(1024n), "1.00 KiB");
    assert.equal(formatBytes(1536n), "1.50 KiB");
});

test("warns about large downloads only at or above the threshold", () => {
    assert.equal(isLargeDownload(LARGE_DOWNLOAD_BYTES - 1n), false);
    assert.equal(isLargeDownload(LARGE_DOWNLOAD_BYTES), true);
    assert.equal(isLargeDownload(LARGE_DOWNLOAD_BYTES * 8n), true);
    assert.equal(isLargeDownload(null), false);
    assert.equal(LARGE_DOWNLOAD_BYTES, 1024n ** 3n);
});

test("formats token units with locale decimals and truncation", () => {
    assert.equal(formatUnits(123456789n, 6), "123.4567");
    assert.equal(formatUnits(1234567890000n, 6), "1,234,567.89");
});

test("formats fixed token precision with rounding", () => {
    assert.equal(formatUnitsFixed(123456789n, 6), "123.4568");
});

test("rounds token values to the requested precision", () => {
    assert.equal(formatUnitsRounded(123456789n, 6), "123.4568");
});

test("formats storage runway boundary states", () => {
    assert.equal(formatStorageHorizon(10n, 0n), "No active storage spend");
    assert.equal(formatStorageHorizon(MAX_UINT256, 1n), "No active storage spend");
    assert.equal(formatStorageHorizon(0n, 1n), "0 days · top-up required");
    assert.equal(formatStorageHorizon(10n, 1n, 1n), "In deficit · top-up required");
    assert.equal(formatStorageHorizon(BigInt(Number.MAX_SAFE_INTEGER) + 1n, 1n), "Very long runway");
});

test("uses singular duration units for exactly one day or hour", () => {
    assert.equal(formatStorageHorizon(EPOCHS_PER_DAY, 1n), `1 day 0 hr · until approx. ${dateLabel(EPOCHS_PER_DAY)}`);
    assert.equal(formatStorageHorizon(EPOCHS_PER_HOUR, 1n), `1 hr · until approx. ${dateLabel(EPOCHS_PER_HOUR)}`);
    assert.equal(formatStorageHorizon(EPOCHS_PER_HOUR * 2n, 1n), `2 hr · until approx. ${dateLabel(EPOCHS_PER_HOUR * 2n)}`);
});
