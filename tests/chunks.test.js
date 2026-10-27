import test from "node:test";
import assert from "node:assert/strict";
import { getChunkRange, renderedCountForIndex } from "../js/chunks.js";

test("getChunkRange returns the next slice and remaining count", () => {
    assert.deepEqual(getChunkRange(0, 250, 100), { start: 0, end: 100, remaining: 150 });
    assert.deepEqual(getChunkRange(200, 250, 100), { start: 200, end: 250, remaining: 0 });
    assert.deepEqual(getChunkRange(0, 0, 100), { start: 0, end: 0, remaining: 0 });
});

test("renderedCountForIndex extends to the chunk containing the index", () => {
    assert.equal(renderedCountForIndex(5, 100, 100), 100);
    assert.equal(renderedCountForIndex(100, 100, 100), 200);
    assert.equal(renderedCountForIndex(250, 100, 100), 300);
});
