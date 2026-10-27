import test from "node:test";
import assert from "node:assert/strict";
import { mapWithConcurrency } from "../js/concurrency.js";

test("maps items in input order without exceeding the concurrency limit", async () => {
    let active = 0;
    let maximumActive = 0;
    const results = await mapWithConcurrency([30, 10, 20, 5], 2, async (delay, index) => {
        active++;
        maximumActive = Math.max(maximumActive, active);
        await new Promise((resolve) => setTimeout(resolve, delay));
        active--;
        return index;
    });

    assert.deepEqual(results, [0, 1, 2, 3]);
    assert.equal(maximumActive, 2);
});

test("returns an empty result for no items", async () => {
    assert.deepEqual(await mapWithConcurrency([], 2, async (item) => item), []);
});

test("rejects invalid concurrency limits", async () => {
    await assert.rejects(mapWithConcurrency([1], 0, async (item) => item), RangeError);
});
