import test from "node:test";
import assert from "node:assert/strict";
import { setLanguage } from "../js/i18n.js";
import { createCarRootQueue } from "../js/car-queue.js";

// Status and failure texts are translated; these assertions expect English.
setLanguage("en");

const tick = () => new Promise((resolve) => setImmediate(resolve));

test("limits concurrency and reports progress", async () => {
    let running = 0;
    let peak = 0;
    const releases = [];
    const fetchCarRoots = () => new Promise((resolve) => {
        running++;
        peak = Math.max(peak, running);
        releases.push(() => { running--; resolve(["root"]); });
    });
    const painted = [];
    const queue = createCarRootQueue({ fetchCarRoots, concurrency: 2, paint: (state) => painted.push(state.status) });
    const states = [{}, {}, {}, {}];
    const loads = states.map((rootState, index) => queue.enqueue(rootState, `cid${index}`, "https://p.example/", null));
    await tick();
    assert.equal(running, 2);
    while (releases.length) {
        releases.shift()();
        await tick();
    }
    await Promise.all(loads);
    assert.equal(peak, 2);
    assert.deepEqual(states.map((rootState) => rootState.status), ["roots", "roots", "roots", "roots"]);
    assert.equal(queue.progress.rootsTotal, 4);
    assert.equal(queue.progress.rootsDone, 4);
});

test("falls back to the CDN and records failures", async () => {
    const calls = [];
    const fetchCarRoots = async (url) => {
        calls.push(url);
        if (url.includes("provider")) throw new Error("HTTP 500");
        return ["cdnRoot"];
    };
    const queue = createCarRootQueue({ fetchCarRoots, concurrency: 1 });
    const ok = {};
    await queue.enqueue(ok, "cid", "https://provider.example/", "https://cdn.example/cid");
    assert.equal(ok.status, "roots");
    assert.equal(ok.source, "FilBeam · provider unavailable");
    assert.deepEqual(ok.roots, ["cdnRoot"]);

    const failed = {};
    await queue.enqueue(failed, "cid", null, null);
    assert.equal(failed.status, "failure");
    assert.match(failed.message, /no PDP endpoint registered; CDN is not enabled/);
});

test("clear aborts active loads and settles dropped ones", async () => {
    const fetchCarRoots = (url, signal) => new Promise((resolve, reject) => {
        signal.addEventListener("abort", () => reject(new Error("aborted")));
    });
    const queue = createCarRootQueue({ fetchCarRoots, concurrency: 1 });
    const first = {};
    const second = {};
    const loads = [
        queue.enqueue(first, "a", "https://p.example/", null),
        queue.enqueue(second, "b", "https://p.example/", null)
    ];
    await tick();
    queue.clear();
    await Promise.all(loads);
    assert.equal(queue.progress.rootsDone, 2);
    assert.equal(first.status, undefined);
    assert.equal(second.status, undefined);
});

test("progress reset and listener", () => {
    const seen = [];
    const queue = createCarRootQueue({ fetchCarRoots: async () => [], concurrency: 1 });
    queue.setProgressListener((progress) => seen.push({ ...progress }));
    queue.resetProgress(3);
    queue.cardDone();
    assert.deepEqual(seen.at(-1), { cardsDone: 1, cardsTotal: 3, rootsDone: 0, rootsTotal: 0 });
});
