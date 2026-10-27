import test from "node:test";
import assert from "node:assert/strict";
import { formatBytes, formatStorageHorizon, formatUnits, formatUnitsFixed, formatUnitsRounded } from "../js/format.js";
import { MAX_UINT256 } from "../js/limits.js";

test("formats byte sizes using binary units", () => {
    assert.equal(formatBytes(0n), "0 B");
    assert.equal(formatBytes(1024n), "1.00 KiB");
    assert.equal(formatBytes(1536n), "1.50 KiB");
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
