import test from "node:test";
import assert from "node:assert/strict";
import { parseCarRoots, pieceBytesToCid, piecePayloadSizeFromBytes } from "../js/car.js";
import { setLanguage } from "../js/i18n.js";

// Error texts can be translated; these assertions expect English.
setLanguage("en");

const ZERO_SHA256_CID_BYTES = [1, 0x55, 0x12, 0x20, ...Array(32).fill(0)];
const ZERO_SHA256_CID = "bafkreiaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";

function encodeVarint(value) {
    const bytes = [];
    while (value > 0x7f) {
        bytes.push((value & 0x7f) | 0x80);
        value >>>= 7;
    }
    bytes.push(value);
    return bytes;
}

function createCarHeader(version = 1) {
    const cidBytes = [0, ...ZERO_SHA256_CID_BYTES];
    const cbor = [
        0xa2,
        0x65, 0x72, 0x6f, 0x6f, 0x74, 0x73,
        0x81, 0xd8, 0x2a, 0x58, cidBytes.length,
        ...cidBytes,
        0x67, 0x76, 0x65, 0x72, 0x73, 0x69, 0x6f, 0x6e,
        version
    ];
    return Uint8Array.from([...encodeVarint(cbor.length), ...cbor]);
}

test("converts a CIDv1 byte sequence to base32", () => {
    assert.equal(pieceBytesToCid(`0x${Buffer.from(ZERO_SHA256_CID_BYTES).toString("hex")}`), ZERO_SHA256_CID);
});

test("rejects malformed and non-CIDv1 piece identifiers", () => {
    assert.throws(() => pieceBytesToCid("0xzz"), /Invalid piece CID/);
    assert.throws(() => pieceBytesToCid("0x0255"), /CIDv1/);
});

test("reads payload size from a valid Filecoin piece CID", () => {
    const commP = [1, 0x55, 0x91, 0x20, 34, 7, 2, ...Array(32).fill(0)];
    assert.equal(piecePayloadSizeFromBytes(`0x${Buffer.from(commP).toString("hex")}`), 120n);
});

test("returns null for unsupported or malformed piece CIDs", () => {
    assert.equal(piecePayloadSizeFromBytes("0x01551220"), null);
    assert.equal(piecePayloadSizeFromBytes("0xzz"), null);
});

test("parses the root CID from a CARv1 header", () => {
    assert.deepEqual(parseCarRoots(createCarHeader()), [ZERO_SHA256_CID]);
});

test("rejects unsupported CAR header versions", () => {
    assert.throws(() => parseCarRoots(createCarHeader(2)), /Unsupported CARv1 header/);
});
