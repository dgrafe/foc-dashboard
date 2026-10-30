import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { buildCidIndex, findCarBlockInTail } from "../js/car.js";
import { fetchWithTimeout } from "../js/fetch-timeout.js";
import { setLanguage } from "../js/i18n.js";

// Error texts can be translated; these assertions expect English.
setLanguage("en");

const sha256 = {
    digest: async (data) => ({ code: 0x12, digest: new Uint8Array(createHash("sha256").update(data).digest()) })
};

async function makeBlock(data, codec = 0x70) {
    const { digest } = await sha256.digest(data);
    const cidBytes = Uint8Array.from([0x01, codec, 0x12, 0x20, ...digest]);
    const cid = { bytes: cidBytes, multihash: { code: 0x12, digest } };
    const length = cidBytes.length + data.length;
    const frame = Uint8Array.from([length, ...cidBytes, ...data]);
    return { cid, frame };
}

test("indexed tail search finds a block among others and ignores garbage", async () => {
    const a = await makeBlock(Uint8Array.from([1, 2, 3, 4]));
    const b = await makeBlock(Uint8Array.from([9, 8, 7]), 0x55);
    const tail = Uint8Array.from([0x01, 0x70, 0x12, 0x20, 5, 5, ...a.frame, ...b.frame]);
    const index = buildCidIndex(tail);
    const foundB = await findCarBlockInTail(tail, 1000, 1000 + tail.length, b.cid, sha256, index);
    assert.deepEqual(Array.from(foundB.bytes), [9, 8, 7]);
    const foundA = await findCarBlockInTail(tail, 1000, 1000 + tail.length, a.cid, sha256, index);
    assert.deepEqual(Array.from(foundA.bytes), [1, 2, 3, 4]);
});

test("tail search rejects a block with a wrong hash and works without index", async () => {
    const a = await makeBlock(Uint8Array.from([1, 2, 3, 4]));
    const tampered = Uint8Array.from(a.frame);
    tampered[tampered.length - 1] ^= 0xff;
    assert.equal(await findCarBlockInTail(tampered, 0, tampered.length, a.cid, sha256, buildCidIndex(tampered)), null);
    const found = await findCarBlockInTail(a.frame, 0, a.frame.length, a.cid, sha256);
    assert.deepEqual(Array.from(found.bytes), [1, 2, 3, 4]);
});

test("fetchWithTimeout aborts slow requests and honours the caller signal", async () => {
    const slowFetch = (url, { signal }) => new Promise((resolve, reject) => {
        signal.addEventListener("abort", () => reject(signal.reason));
    });
    await assert.rejects(fetchWithTimeout("x", {}, { timeoutMs: 10, fetchImpl: slowFetch }), /timed out/);
    const controller = new AbortController();
    const pending = fetchWithTimeout("x", {}, { signal: controller.signal, timeoutMs: 1000, fetchImpl: slowFetch });
    controller.abort(new Error("stopped"));
    await assert.rejects(pending, /stopped/);
    const ok = await fetchWithTimeout("x", {}, { timeoutMs: 1000, fetchImpl: async () => "ok" });
    assert.equal(ok, "ok");
});
