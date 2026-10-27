import test from "node:test";
import assert from "node:assert/strict";
import { encodeFunctionData, decodeFunctionResult, encodeFunctionResult } from "viem";
import { addPieceToIndex, countDuplicateCopies, getDuplicateCopies } from "../js/piece-index.js";

test("duplicate copies can be limited while the total is still known", () => {
    const index = new Map();
    const piece = { cid: "bafk-x", size: 1n, id: 1n };
    const occurrences = [1n, 2n, 3n, 4n].map((dataSetId) => addPieceToIndex(index, piece, dataSetId, null, null));
    const indexed = occurrences[0].indexedPiece;
    const copies = getDuplicateCopies(indexed, occurrences[0].occurrence, 2);
    assert.equal(copies.length, 2);
    assert.equal(countDuplicateCopies(indexed), 3);
    assert.equal(getDuplicateCopies(indexed, occurrences[0].occurrence).length, 3);
});
import { createRpc } from "../js/rpc.js";
import { hexToBytes, parseCarRoots, parseContentRangeTotal, piecePayloadSizeFromBytes } from "../js/car.js";

test("parseContentRangeTotal reads the total length", () => {
    assert.equal(parseContentRangeTotal("bytes 0-16383/123456"), 123456);
    assert.ok(Number.isNaN(parseContentRangeTotal("bytes 0-5/*")));
    assert.ok(Number.isNaN(parseContentRangeTotal(null)));
});

function varint(value) {
    const bytes = [];
    while (value > 0x7f) {
        bytes.push((value & 0x7f) | 0x80);
        value >>>= 7;
    }
    bytes.push(value);
    return bytes;
}

const sha256Cid = (fill) => [1, 0x55, 0x12, 0x20, ...Array(32).fill(fill)];
const taggedRoot = (cid) => [0xd8, 0x2a, 0x58, cid.length + 1, 0, ...cid];

function carHeader(rootsCbor, rootCount) {
    const cbor = [
        0xa2,
        0x65, 0x72, 0x6f, 0x6f, 0x74, 0x73,
        0x80 + rootCount, ...rootsCbor,
        0x67, 0x76, 0x65, 0x72, 0x73, 0x69, 0x6f, 0x6e, 1
    ];
    return Uint8Array.from([...varint(cbor.length), ...cbor]);
}

const piece = (cid, id, size = 100n) => ({ cid, id, size });

test("indexes a first piece occurrence", () => {
    const index = new Map();
    const { indexedPiece, occurrence } = addPieceToIndex(index, piece("cidA", 1n), 7n, "https://sp.example", null);
    assert.equal(index.get("cidA"), indexedPiece);
    assert.deepEqual(indexedPiece.datasets, [occurrence]);
    assert.deepEqual(indexedPiece.sources, [{ providerUrl: "https://sp.example/piece/cidA", cdnUrl: null }]);
});

test("tracks duplicate pieces across datasets and deduplicates sources", () => {
    const index = new Map();
    const first = addPieceToIndex(index, piece("cidA", 1n), 7n, "https://sp.example", null);
    const second = addPieceToIndex(index, piece("cidA", 4n), 8n, "https://sp.example", null);
    const third = addPieceToIndex(index, piece("cidA", 5n), 9n, "https://other.example", "https://cdn.example/cidA");

    assert.equal(first.indexedPiece, second.indexedPiece);
    assert.equal(first.indexedPiece.datasets.length, 3);
    assert.equal(first.indexedPiece.sources.length, 2);
    assert.deepEqual(getDuplicateCopies(first.indexedPiece, first.occurrence), [
        { label: "Dataset 8 · PieceID 4", targetId: "piece-8-4" },
        { label: "Dataset 9 · PieceID 5", targetId: "piece-9-5" }
    ]);
    assert.equal(getDuplicateCopies(third.indexedPiece, third.occurrence).length, 2);
});

test("adopts a known size when only a later duplicate has one", () => {
    const index = new Map();
    addPieceToIndex(index, piece("cidA", 1n, null), 7n, null, null);
    addPieceToIndex(index, piece("cidA", 2n, 64n), 8n, null, null);
    assert.equal(index.get("cidA").size, 64n);
    assert.deepEqual(index.get("cidA").sources, [{ providerUrl: null, cdnUrl: null }]);
});

test("reports no copies for a unique piece", () => {
    const index = new Map();
    const { indexedPiece, occurrence } = addPieceToIndex(index, piece("cidA", 1n), 7n, null, null);
    assert.deepEqual(getDuplicateCopies(indexedPiece, occurrence), []);
});

test("parses multiple CAR roots", () => {
    const header = carHeader([...taggedRoot(sha256Cid(1)), ...taggedRoot(sha256Cid(2))], 2);
    const roots = parseCarRoots(header);
    assert.equal(roots.length, 2);
    assert.notEqual(roots[0], roots[1]);
});

test("parses root CIDs from a CARv2 container", () => {
    const inner = carHeader(taggedRoot(sha256Cid(3)), 1);
    const pragma = [0x0a, 0xa1, 0x67, 0x76, 0x65, 0x72, 0x73, 0x69, 0x6f, 0x6e, 0x02];
    const header = new Uint8Array(40);
    new DataView(header.buffer).setBigUint64(16, 51n, true);
    const v1Roots = parseCarRoots(inner);
    assert.deepEqual(parseCarRoots(Uint8Array.from([...pragma, ...header, ...inner])), v1Roots);
});

test("rejects malformed CARv2 headers", () => {
    const pragma = [0x0a, 0xa1, 0x67, 0x76, 0x65, 0x72, 0x73, 0x69, 0x6f, 0x6e, 0x02];
    assert.throws(() => parseCarRoots(Uint8Array.from([...pragma, 0, 0])), /larger than the requested range/);
    const header = new Uint8Array(40);
    new DataView(header.buffer).setBigUint64(16, 5n, true);
    assert.throws(() => parseCarRoots(Uint8Array.from([...pragma, ...header, 0])), /Invalid CARv2 data offset/);
});

test("rejects truncated CAR headers", () => {
    const header = carHeader(taggedRoot(sha256Cid(1)), 1);
    assert.throws(() => parseCarRoots(header.subarray(0, 20)), /larger than the requested range/);
});

test("rejects CAR headers without roots", () => {
    assert.throws(() => parseCarRoots(carHeader([], 0)), /no root CID/);
});

test("rejects roots without CID tag, non-CIDv1 roots and indefinite CBOR", () => {
    assert.throws(() => parseCarRoots(carHeader([0x41, 0x00], 1)), /Invalid CID encoding/);
    const v0Root = [0xd8, 0x2a, 0x58, 5, 0, 0x12, 0x20, 1, 2];
    assert.throws(() => parseCarRoots(carHeader(v0Root, 1)), /not CIDv1/);
    const indefinite = Uint8Array.from([...varint(3), 0x9f, 0x01, 0xff]);
    assert.throws(() => parseCarRoots(indefinite), /Unsupported CARv1 header|Indefinite-length/);
});

test("validates hex input", () => {
    assert.deepEqual(Array.from(hexToBytes("0x0aFF")), [10, 255]);
    assert.deepEqual(Array.from(hexToBytes("0aff")), [10, 255]);
    for (const bad of ["", "0x", "0xabc", "0xzz"]) assert.throws(() => hexToBytes(bad), /Invalid piece CID/);
});

test("rejects piece CIDs with invalid size encoding", () => {
    const hex = (bytes) => `0x${Buffer.from(bytes).toString("hex")}`;
    const digest = Array(32).fill(0);
    assert.equal(piecePayloadSizeFromBytes(hex([1, 0x55, 0x91, 0x20, 34, 0, 1, ...digest])), null);
    assert.equal(piecePayloadSizeFromBytes(hex([1, 0x55, 0x91, 0x20, 33, 0, 5, ...digest])), null);
    assert.equal(piecePayloadSizeFromBytes(hex([1, 0x70, 0x91, 0x20, 34, 0, 5, ...digest])), null);
    assert.equal(piecePayloadSizeFromBytes(hex([1, 0x55, 0x91, 0x20, 35, 0xc8, 0x01, 2, ...digest])), null);
    assert.equal(piecePayloadSizeFromBytes(hex([1, 0x55, 0x91, 0x20, 34, 0, 2, ...digest])), 127n);
});

const abi = [{
    type: "function", name: "value", stateMutability: "view",
    inputs: [], outputs: [{ name: "", type: "uint256" }]
}];
const jsonResponse = (body, ok = true, status = 200) => ({ ok, status, json: async () => body });

function createTestRpc(fetchImpl, options = {}) {
    return createRpc({ getUrl: () => "https://rpc.example", encodeFunctionData, decodeFunctionResult, fetchImpl, maxRetries: 0, sleep: async () => {}, ...options });
}

test("retries transient failures and does not retry JSON-RPC errors", async () => {
    let calls = 0;
    const delays = [];
    const flaky = createTestRpc(async () => {
        calls++;
        if (calls === 1) throw new TypeError("network down");
        if (calls === 2) return jsonResponse({}, false, 503);
        return jsonResponse({ result: "0x2" });
    }, { maxRetries: 2, retryDelayMs: 10, sleep: async (ms) => { delays.push(ms); } });
    assert.equal(await flaky.rpcRequest("m", []), "0x2");
    assert.equal(calls, 3);
    assert.deepEqual(delays, [10, 30]);

    let reverts = 0;
    const revert = createTestRpc(async () => { reverts++; return jsonResponse({ error: { message: "revert" } }); }, { maxRetries: 2 });
    await assert.rejects(revert.rpcRequest("m", []), /revert/);
    assert.equal(reverts, 1);

    let clientErrors = 0;
    const bad = createTestRpc(async () => { clientErrors++; return jsonResponse({}, false, 400); }, { maxRetries: 2 });
    await assert.rejects(bad.rpcRequest("m", []), /RPC HTTP error 400/);
    assert.equal(clientErrors, 1);
});

test("gives up after the retry limit, times out and honours abort", async () => {
    let calls = 0;
    const down = createTestRpc(async () => { calls++; return jsonResponse({}, false, 502); }, { maxRetries: 2 });
    await assert.rejects(down.rpcRequest("m", []), /RPC HTTP error 502/);
    assert.equal(calls, 3);

    const hanging = (url, { signal }) => new Promise((resolve, reject) => signal.addEventListener("abort", () => reject(signal.reason)));
    await assert.rejects(createTestRpc(hanging, { timeoutMs: 10 }).rpcRequest("m", []), /timed out/);

    const controller = new AbortController();
    let abortedCalls = 0;
    const aborting = createTestRpc(async (url, { signal }) => { abortedCalls++; controller.abort(new Error("stopped")); throw signal.reason; }, { maxRetries: 2, getSignal: () => controller.signal });
    await assert.rejects(aborting.rpcRequest("m", []), /stopped/);
    assert.equal(abortedCalls, 1);
});

test("posts JSON-RPC requests and returns the result", async () => {
    let captured;
    const { rpcRequest } = createTestRpc(async (url, init) => {
        captured = { url, init };
        return jsonResponse({ result: "0x1" });
    });
    assert.equal(await rpcRequest("eth_chainId", []), "0x1");
    assert.equal(captured.url, "https://rpc.example");
    assert.equal(captured.init.method, "POST");
    assert.deepEqual(JSON.parse(captured.init.body), { jsonrpc: "2.0", method: "eth_chainId", params: [], id: 1 });
});

test("surfaces HTTP and JSON-RPC errors", async () => {
    await assert.rejects(createTestRpc(async () => jsonResponse({}, false, 503)).rpcRequest("m", []), /RPC HTTP error 503/);
    await assert.rejects(createTestRpc(async () => jsonResponse({ error: { message: "boom" } })).rpcRequest("m", []), /boom/);
    await assert.rejects(createTestRpc(async () => jsonResponse({ error: {} })).rpcRequest("m", []), /RPC call failed/);
});

test("decodes contract call results and rejects empty responses", async () => {
    const encoded = encodeFunctionResult({ abi, functionName: "value", result: 42n });
    const ok = createTestRpc(async () => jsonResponse({ result: encoded }));
    assert.equal(await ok.rpcCall("0x0000000000000000000000000000000000000001", abi, "value", []), 42n);

    const empty = createTestRpc(async () => jsonResponse({ result: "0x" }));
    await assert.rejects(empty.rpcCall("0x0000000000000000000000000000000000000001", abi, "value", []), /Empty response/);
});
