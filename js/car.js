import { MAX_TREE_SCAN_BYTES, MAX_TREE_NODES, CAR_HEADER_RANGE_BYTES, CAR_TAIL_INITIAL_RANGE_BYTES, CAR_TAIL_RANGE_BYTES, CAR_RANGE_TIMEOUT_MS, CAR_STREAM_TIMEOUT_MS } from "./limits.js";
import { formatBytes } from "./format.js";
import { fetchWithTimeout } from "./fetch-timeout.js";

export async function fetchUnixFsFileTree(piece, signal) {
    const errors = [];
    const attempted = new Set();
    for (const source of piece.sources) {
        if (signal?.aborted) throw signal.reason ?? new Error("Aborted.");
        if (source.providerUrl && !attempted.has(source.providerUrl)) {
            attempted.add(source.providerUrl);
            try {
                return { source: "Storage provider", ...await scanUnixFsCar(source.providerUrl, piece.size, signal) };
            } catch (error) {
                errors.push(`Provider: ${error.message}`);
            }
        }
        if (source.cdnUrl && !attempted.has(source.cdnUrl)) {
            attempted.add(source.cdnUrl);
            try {
                return { source: "FilBeam", ...await scanUnixFsCar(source.cdnUrl, piece.size, signal) };
            } catch (error) {
                errors.push(`FilBeam: ${error.message}`);
            }
        }
    }
    throw new Error(errors.join("; ") || "No provider or CDN endpoint is available.");
}

function fetchRange(url, range, signal) {
    return fetchWithTimeout(url, { headers: { Range: range } }, { signal, timeoutMs: CAR_RANGE_TIMEOUT_MS });
}

async function scanUnixFsCar(url, pieceSize, signal) {
    const totalGuess = Number(pieceSize);
    // Header and tail are requested together; the tail is only used for CARv1.
    const initialTail = Number.isSafeInteger(totalGuess) && totalGuess > 0
        ? Math.min(CAR_TAIL_INITIAL_RANGE_BYTES, totalGuess)
        : 0;
    const prefetchedTail = initialTail > 0
        ? prefetchTail(url, totalGuess - initialTail, totalGuess, signal)
        : Promise.resolve(null);
    const [libraries, firstRange] = await Promise.all([
        Promise.all([
            import("https://esm.sh/@ipld/car@5?bundle"),
            import("https://esm.sh/@ipld/unixfs@3?bundle"),
            import("https://esm.sh/@ipld/dag-pb@4?bundle"),
            import("https://esm.sh/ipfs-unixfs@11?bundle")
        ]),
        fetchRange(url, `bytes=0-${CAR_HEADER_RANGE_BYTES - 1}`, signal).catch((error) => {
            prefetchedTail.catch(() => {});
            throw error;
        })
    ]);
    const [{ CarBlockIterator }, UnixFS, dagPb, legacyUnixFS] = libraries;
    if (firstRange.status === 200) {
        return scanUnixFsCarStream(firstRange, CarBlockIterator, UnixFS, dagPb, legacyUnixFS);
    }
    if (firstRange.status !== 206) throw new Error(`HTTP ${firstRange.status}`);

    const header = parseCarHeader(new Uint8Array(await firstRange.arrayBuffer()));
    // Content-Range is only readable if the server exposes it via CORS; otherwise use the piece size.
    const reportedLength = parseContentRangeTotal(firstRange.headers.get("Content-Range"));
    const totalLength = Number.isSafeInteger(reportedLength) ? reportedLength : totalGuess;
    if (header.version === 1 && Number.isSafeInteger(totalLength) && totalLength > header.dataOffset) {
        try {
            const initial = totalLength === totalGuess ? await prefetchedTail : null;
            const tree = await scanTail(url, header, totalLength, initial, signal, UnixFS, dagPb, legacyUnixFS);
            if (tree) return tree;
        } catch (error) {
            if (signal?.aborted) throw error;
            // Fall back to the full stream scan below.
        }
    }

    const response = await fetchWithTimeout(url, {}, { signal, timeoutMs: CAR_STREAM_TIMEOUT_MS });
    if (response.status !== 200 && response.status !== 206) throw new Error(`HTTP ${response.status}`);
    return scanUnixFsCarStream(response, CarBlockIterator, UnixFS, dagPb, legacyUnixFS);
}

async function prefetchTail(url, start, totalLength, signal) {
    try {
        const response = await fetchRange(url, `bytes=${start}-${totalLength - 1}`, signal);
        if (response.status !== 206) {
            await response.body?.cancel().catch(() => {});
            return null;
        }
        const bytes = new Uint8Array(await response.arrayBuffer());
        return bytes.length === totalLength - start ? { start, bytes } : null;
    } catch {
        return null;
    }
}

export function parseContentRangeTotal(value) {
    const match = /^bytes\s+\d+-\d+\/(\d+)$/i.exec(value ?? "");
    return match ? Number(match[1]) : NaN;
}

async function scanTail(url, header, totalLength, initial, signal, UnixFS, dagPb, legacyUnixFS) {
    const maxTailBytes = Math.min(CAR_TAIL_RANGE_BYTES, totalLength - header.dataOffset);
    let tailBytesCount = Math.min(CAR_TAIL_INITIAL_RANGE_BYTES, maxTailBytes);
    const [{ CID }, { sha256 }] = await Promise.all([
        import("https://esm.sh/multiformats@13/cid?bundle"),
        import("https://esm.sh/multiformats@13/hashes/sha2?bundle")
    ]);
    const roots = header.roots.map((root) => CID.parse(root));

    let tailBytes = initial ? initial.bytes : new Uint8Array(0);
    let tailStart = initial ? initial.start : totalLength;
    while (tailBytesCount > 0) {
        const newStart = totalLength - tailBytesCount;
        if (newStart < tailStart) {
            const tailRange = await fetchRange(url, `bytes=${newStart}-${tailStart - 1}`, signal);
            if (tailRange.status === 200) {
                await tailRange.body?.cancel().catch(() => {});
                return null;
            }
            if (tailRange.status !== 206) throw new Error(`Tail-Range-HTTP ${tailRange.status}`);
            const extra = new Uint8Array(await tailRange.arrayBuffer());
            if (extra.length !== tailStart - newStart) throw new Error("Unexpected tail range length.");
            const merged = new Uint8Array(extra.length + tailBytes.length);
            merged.set(extra);
            merged.set(tailBytes, extra.length);
            tailBytes = merged;
            tailStart = newStart;
        }
        const index = buildCidIndex(tailBytes);
        const state = createUnixFsState(roots);
        while (state.pending.size > 0) {
            let foundBlock = false;
            for (const cid of Array.from(state.pending.values())) {
                const block = await findCarBlockInTail(tailBytes, tailStart, totalLength, cid, sha256, index);
                if (!block) continue;
                processUnixFsBlock(state, block, UnixFS, dagPb, legacyUnixFS);
                foundBlock = true;
            }
            if (!foundBlock) break;
        }
        if (state.pending.size === 0 && roots.every((root) => state.records.has(root.toString()))) {
            return finishUnixFsTree(state);
        }
        if (tailBytesCount >= maxTailBytes) break;
        tailBytesCount = Math.min(tailBytesCount * 4, maxTailBytes);
    }
    return null;
}

const SHA256_CID_LENGTH = 36;

// Positions of all CIDv1 (dag-pb/raw + sha2-256) byte sequences, keyed by their bytes.
export function buildCidIndex(bytes) {
    const index = new Map();
    for (let position = 0; position <= bytes.length - SHA256_CID_LENGTH; position++) {
        if (bytes[position] !== 0x01 || bytes[position + 2] !== 0x12 || bytes[position + 3] !== 0x20) continue;
        if (bytes[position + 1] !== 0x70 && bytes[position + 1] !== 0x55) continue;
        const key = String.fromCharCode(...bytes.subarray(position, position + SHA256_CID_LENGTH));
        const positions = index.get(key);
        if (positions) positions.push(position);
        else index.set(key, [position]);
    }
    return index;
}

function candidatePositions(bytes, target, index) {
    if (index && target.length === SHA256_CID_LENGTH && target[0] === 0x01) {
        return index.get(String.fromCharCode(...target)) ?? [];
    }
    const positions = [];
    for (let position = 0; position <= bytes.length - target.length; position++) {
        let matches = true;
        for (let byteIndex = 0; byteIndex < target.length; byteIndex++) {
            if (bytes[position + byteIndex] !== target[byteIndex]) {
                matches = false;
                break;
            }
        }
        if (matches) positions.push(position);
    }
    return positions;
}

export async function findCarBlockInTail(bytes, absoluteStart, totalLength, cid, sha256, index) {
    const target = cid.bytes;
    for (const position of candidatePositions(bytes, target, index)) {
        const found = await verifyCarBlockAt(bytes, absoluteStart, totalLength, cid, sha256, position);
        if (found) return found;
    }
    return null;
}

async function verifyCarBlockAt(bytes, absoluteStart, totalLength, cid, sha256, index) {
    const target = cid.bytes;
    for (let prefixLength = 1; prefixLength <= 10; prefixLength++) {
        const frameStart = index - prefixLength;
        if (frameStart < 0) continue;
        let frame;
        try {
            frame = readVarint(bytes, frameStart);
        } catch {
            continue;
        }
        if (frame.offset - frameStart !== prefixLength || frame.value < prefixLength + target.length) continue;
        const blockEnd = absoluteStart + frame.offset + frame.value;
        if (blockEnd > totalLength) continue;
        const dataStart = index + target.length;
        const dataEnd = frameStart + prefixLength + frame.value;
        const blockBytes = bytes.subarray(dataStart, dataEnd);
        const digest = await sha256.digest(blockBytes);
        if (digest.code !== cid.multihash.code || digest.digest.length !== cid.multihash.digest.length) continue;
        let digestMatches = true;
        for (let digestIndex = 0; digestIndex < digest.digest.length; digestIndex++) {
            if (digest.digest[digestIndex] !== cid.multihash.digest[digestIndex]) {
                digestMatches = false;
                break;
            }
        }
        if (digestMatches) return { cid, bytes: blockBytes };
    }
    return null;
}

async function* boundedCarStream(body, maximumBytes) {
    const reader = body.getReader();
    let totalBytes = 0;
    try {
        while (true) {
            const { value, done } = await reader.read();
            if (done) return;
            totalBytes += value.byteLength;
            if (totalBytes > maximumBytes) {
                throw new Error(`CAR scan exceeds ${formatBytes(BigInt(maximumBytes))}; display stopped for safety.`);
            }
            yield value;
        }
    } finally {
        await reader.cancel().catch(() => {});
    }
}

async function scanUnixFsCarStream(response, CarBlockIterator, UnixFS, dagPb, legacyUnixFS) {
    if (!response.body) throw new Error("The browser cannot read the CAR stream.");
    const iterator = await CarBlockIterator.fromIterable(boundedCarStream(response.body, MAX_TREE_SCAN_BYTES));
    if (iterator.version !== 1 && iterator.version !== 2) throw new Error("Only CARv1 and CARv2 are supported.");
    const roots = await iterator.getRoots();
    if (roots.length === 0) throw new Error("CAR contains no root CID.");
    const state = createUnixFsState(roots);
    if (state.pending.size > 0) {
        for await (const block of iterator) {
            processUnixFsBlock(state, block, UnixFS, dagPb, legacyUnixFS);
            if (state.pending.size === 0) break;
        }
    }
    return finishUnixFsTree(state);
}

function createUnixFsState(roots) {
    const records = new Map();
    const pending = new Map();
    const requestNode = (cid) => {
        const key = cid.toString();
        if (records.has(key) || pending.has(key)) return;
        if (cid.code === 0x55) records.set(key, { kind: "file", entries: [] });
        else if (cid.code === 0x70) pending.set(key, cid);
        else records.set(key, { kind: "unsupported", entries: [] });
    };
    roots.forEach(requestNode);
    return { roots, records, pending, requestNode, scannedNodes: 0 };
}

function processUnixFsBlock(state, block, UnixFS, dagPb, legacyUnixFS) {
    const key = block.cid.toString();
    if (!state.pending.has(key)) return;
    state.pending.delete(key);
    state.scannedNodes++;
    if (state.scannedNodes > MAX_TREE_NODES) throw new Error(`UnixFS tree exceeds ${MAX_TREE_NODES} nodes.`);

    const record = decodeUnixFsBlock(block.bytes, UnixFS, dagPb, legacyUnixFS);
    state.records.set(key, record);
    if (record.kind === "directory") {
        for (const entry of record.entries) state.requestNode(entry.cid);
    }
}

function finishUnixFsTree(state, unresolvedKind = "missing") {
    for (const [key] of state.pending) state.records.set(key, { kind: unresolvedKind, entries: [] });
    return { roots: state.roots, records: state.records, scannedNodes: state.scannedNodes };
}

function decodeUnixFsBlock(bytes, UnixFS, dagPb, legacyUnixFS) {
    try {
        const node = UnixFS.decode(bytes);
        const kind = unixFsKind(node.type, UnixFS.NodeType);
        if (kind !== "unsupported") {
            return {
                kind,
                entries: (node.entries || []).map((link) => ({ name: link.name || link.cid.toString(), cid: link.cid })),
                fileSize: kind === "file" ? unixFsFileSize(node) : null
            };
        }
    } catch {
        // Some valid legacy File nodes are not decoded by the current UnixFS reader.
    }

    try {
        const block = dagPb.decode(bytes);
        if (!block.Data) return { kind: "unsupported", entries: [] };
        const node = legacyUnixFS.UnixFS.unmarshal(block.Data);
        const kind = legacyUnixFsKind(node.type);
        const entries = kind === "directory"
            ? (block.Links || []).map((link) => ({ name: link.Name || link.Hash.toString(), cid: link.Hash }))
            : [];
        return { kind, entries, fileSize: kind === "file" ? legacyUnixFsFileSize(node) : null };
    } catch {
        return { kind: "unsupported", entries: [] };
    }
}

function unixFsKind(type, nodeTypes) {
    if (type === nodeTypes.Directory || type === nodeTypes.HAMTShard) return "directory";
    if (type === nodeTypes.File || type === nodeTypes.Raw) return "file";
    if (type === nodeTypes.Symlink) return "symlink";
    if (type === nodeTypes.Metadata) return "metadata";
    return "unsupported";
}

function legacyUnixFsKind(type) {
    if (type === "directory" || type === "hamt-sharded-directory") return "directory";
    if (type === "file" || type === "raw") return "file";
    if (type === "symlink") return "symlink";
    if (type === "metadata") return "metadata";
    return "unsupported";
}

function unixFsFileSize(node) {
    let size = BigInt(node.content?.byteLength || 0);
    for (const part of node.parts || []) size += BigInt(part.contentByteLength || 0);
    return size;
}

function legacyUnixFsFileSize(node) {
    let size = BigInt(node.data?.byteLength || 0);
    for (const blockSize of node.blockSizes || []) size += BigInt(blockSize);
    return size;
}

export function renderUnixFsTree(container, tree) {
    container.replaceChildren();
    const source = document.createElement("div");
    source.className = "piece-id";
    source.textContent = `UnixFS · ${tree.source} · ${tree.scannedNodes} nodes read`;
    container.appendChild(source);

    const list = document.createElement("ul");
    list.className = "filesystem-tree";
    const renderEntry = (parent, cid, name, depth, ancestors) => {
        const key = cid.toString();
        const record = tree.records.get(key);
        const kind = record?.kind || "missing";
        const item = document.createElement("li");

        if (kind === "directory") {
            const disclosure = document.createElement("details");
            disclosure.open = depth === 0;
            const heading = document.createElement("summary");
            heading.textContent = `${name}/ · Directory`;
            disclosure.appendChild(heading);
            if (record.entries.length) {
                if (depth >= 40 || ancestors.has(key)) {
                    const limit = document.createElement("div");
                    limit.className = "filesystem-kind";
                    limit.textContent = "Deeper levels are not shown.";
                    disclosure.appendChild(limit);
                } else {
                    const nextAncestors = new Set(ancestors);
                    nextAncestors.add(key);
                    const children = document.createElement("ul");
                    for (const entry of record.entries) renderEntry(children, entry.cid, entry.name, depth + 1, nextAncestors);
                    disclosure.appendChild(children);
                }
            }
            item.appendChild(disclosure);
            parent.appendChild(item);
            return;
        }

        const label = document.createElement("span");
        label.textContent = name;
        item.appendChild(label);
        const type = document.createElement("span");
        type.className = "filesystem-kind";
        const labels = { directory: "Directory", file: "File", entry: "UnixFS entry", symlink: "Symlink", metadata: "Metadata", missing: "Block missing from CAR", unsupported: "Unrecognized UnixFS type" };
        type.textContent = kind === "file" && record?.fileSize != null
            ? ` · File · ${formatBytes(BigInt(record.fileSize))}`
            : ` · ${labels[kind]}`;
        item.appendChild(type);
        parent.appendChild(item);
    };
    tree.roots.forEach((cid, index) => {
        const rootRecord = tree.records.get(cid.toString());
        const name = tree.roots.length === 1
            ? rootRecord?.kind === "directory" ? "Root" : rootRecord?.kind === "file" ? "Root file" : "/"
            : `Root ${index + 1}`;
        renderEntry(list, cid, name, 0, new Set());
    });
    container.appendChild(list);
}

export async function fetchCarRoots(url, signal) {
    const response = await fetch(url, { headers: { Range: "bytes=0-199" }, signal });
    if (response.status !== 200 && response.status !== 206) {
        throw new Error(`HTTP ${response.status}`);
    }
    return parseCarRoots(await readAtMost(response, 200));
}

async function readAtMost(response, maxBytes) {
    if (!response.body) throw new Error("The browser cannot read the piece stream.");
    const reader = response.body.getReader();
    const chunks = [];
    let total = 0;
    try {
        while (total < maxBytes) {
            const { value, done } = await reader.read();
            if (done) break;
            const chunk = value.subarray(0, maxBytes - total);
            chunks.push(chunk);
            total += chunk.length;
        }
    } finally {
        await reader.cancel().catch(() => {});
    }
    const result = new Uint8Array(total);
    let offset = 0;
    for (const chunk of chunks) {
        result.set(chunk, offset);
        offset += chunk.length;
    }
    return result;
}

export function parseCarRoots(bytes) {
    return parseCarHeader(bytes).roots;
}

const CARV2_PRAGMA = Uint8Array.from([0x0a, 0xa1, 0x67, 0x76, 0x65, 0x72, 0x73, 0x69, 0x6f, 0x6e, 0x02]);
const CARV2_HEADER_BYTES = 40;

function parseCarHeader(bytes) {
    const isV2 = CARV2_PRAGMA.every((byte, index) => bytes[index] === byte);
    if (!isV2) return { ...parseCarV1Header(bytes, 0), version: 1 };

    const headerEnd = CARV2_PRAGMA.length + CARV2_HEADER_BYTES;
    if (bytes.length < headerEnd) throw new Error("CAR header is larger than the requested range.");
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.length);
    const dataOffset = view.getBigUint64(CARV2_PRAGMA.length + 16, true);
    if (dataOffset < BigInt(headerEnd) || dataOffset > BigInt(Number.MAX_SAFE_INTEGER)) {
        throw new Error("Invalid CARv2 data offset.");
    }
    if (Number(dataOffset) >= bytes.length) throw new Error("CAR header is larger than the requested range.");
    return { ...parseCarV1Header(bytes, Number(dataOffset)), version: 2 };
}

function parseCarV1Header(bytes, start) {
    const frame = readVarint(bytes, start);
    const headerEnd = frame.offset + frame.value;
    if (headerEnd > bytes.length) throw new Error("CAR header is larger than the requested range.");
    const parsed = readCbor(bytes, frame.offset);
    if (!(parsed.value instanceof Map) || parsed.value.get("version") !== 1) throw new Error("Unsupported CARv1 header.");
    const roots = parsed.value.get("roots");
    if (!Array.isArray(roots) || roots.length === 0) throw new Error("CAR header contains no root CID.");
    const cids = roots.map((root) => {
        if (!root || root.tag !== 42 || !(root.value instanceof Uint8Array) || root.value[0] !== 0) {
            throw new Error("Invalid CID encoding in CAR header.");
        }
        const cidBytes = root.value.subarray(1);
        const version = readVarint(cidBytes, 0);
        if (version.value !== 1) throw new Error("CAR root is not CIDv1.");
        return `b${base32(cidBytes)}`;
    });
    return { roots: cids, dataOffset: headerEnd };
}

function readVarint(bytes, start) {
    let value = 0n;
    let shift = 0n;
    let offset = start;
    for (let count = 0; count < 10; count++) {
        if (offset >= bytes.length) throw new Error("Incomplete CAR varint.");
        const byte = bytes[offset++];
        value |= BigInt(byte & 0x7f) << shift;
        if ((byte & 0x80) === 0) {
            if (value > BigInt(Number.MAX_SAFE_INTEGER)) throw new Error("CAR header is too large.");
            return { value: Number(value), offset };
        }
        shift += 7n;
    }
    throw new Error("Invalid CAR varint.");
}

function readCbor(bytes, start) {
    let offset = start;
    function parse() {
        if (offset >= bytes.length) throw new Error("Incomplete CBOR header.");
        const initial = bytes[offset++];
        const major = initial >> 5;
        const additional = initial & 31;
        let length;
        if (additional < 24) length = additional;
        else if (additional === 24) length = bytes[offset++];
        else if (additional === 25) { length = (bytes[offset] << 8) | bytes[offset + 1]; offset += 2; }
        else if (additional === 26) {
            length = new DataView(bytes.buffer, bytes.byteOffset + offset, 4).getUint32(0);
            offset += 4;
        } else if (additional === 27) {
            const high = new DataView(bytes.buffer, bytes.byteOffset + offset, 8).getBigUint64(0);
            if (high > BigInt(Number.MAX_SAFE_INTEGER)) throw new Error("CBOR value is outside the supported range.");
            length = Number(high);
            offset += 8;
        } else throw new Error("Indefinite-length CBOR values are not supported.");

        if (major === 0) return length;
        if (major === 1) return -1 - length;
        if (major === 2 || major === 3) {
            const end = offset + length;
            if (end > bytes.length) throw new Error("Incomplete CBOR value in CAR header.");
            const value = bytes.subarray(offset, end);
            offset = end;
            return major === 2 ? value : new TextDecoder().decode(value);
        }
        if (major === 4) return Array.from({ length }, parse);
        if (major === 5) {
            const map = new Map();
            for (let index = 0; index < length; index++) map.set(parse(), parse());
            return map;
        }
        if (major === 6) return { tag: length, value: parse() };
        if (major === 7) {
            if (additional === 20) return false;
            if (additional === 21) return true;
            if (additional === 22) return null;
        }
        throw new Error("Unsupported CBOR type in CAR header.");
    }
    const value = parse();
    return { value, offset };
}

function base32(bytes) {
    const alphabet = "abcdefghijklmnopqrstuvwxyz234567";
    let output = "";
    let buffer = 0;
    let bits = 0;
    for (const byte of bytes) {
        buffer = (buffer << 8) | byte;
        bits += 8;
        while (bits >= 5) {
            output += alphabet[(buffer >>> (bits - 5)) & 31];
            bits -= 5;
        }
    }
    if (bits > 0) output += alphabet[(buffer << (5 - bits)) & 31];
    return output;
}

export function pieceBytesToCid(hex) {
    const bytes = hexToBytes(hex);
    const version = readVarint(bytes, 0);
    if (version.value !== 1) throw new Error("Piece CID is not CIDv1.");
    return `b${base32(bytes)}`;
}

export function piecePayloadSizeFromBytes(hex) {
    try {
        const bytes = hexToBytes(hex);
        const version = readVarint(bytes, 0);
        const codec = readVarint(bytes, version.offset);
        const hashCode = readVarint(bytes, codec.offset);
        const digestLength = readVarint(bytes, hashCode.offset);
        if (version.value !== 1 || codec.value !== 0x55 || hashCode.value !== 0x1011) return null;

        const digestStart = digestLength.offset;
        const digestEnd = digestStart + digestLength.value;
        if (digestEnd !== bytes.length) return null;
        const padding = readVarint(bytes, digestStart);
        if (digestStart + (padding.offset - digestStart) + 1 + 32 !== digestEnd) return null;

        const height = bytes[padding.offset];
        if (height < 2) return null;
        const paddedSize = 127n * (1n << BigInt(height - 2));
        const payloadSize = paddedSize - BigInt(padding.value);
        return payloadSize >= 0n ? payloadSize : null;
    } catch {
        return null;
    }
}

export function hexToBytes(hex) {
    const clean = hex.startsWith("0x") ? hex.slice(2) : hex;
    if (!clean || clean.length % 2 !== 0 || !/^[\da-f]+$/i.test(clean)) {
        throw new Error("Invalid piece CID returned by the contract.");
    }
    return Uint8Array.from({ length: clean.length / 2 }, (_, index) => parseInt(clean.slice(index * 2, index * 2 + 2), 16));
}
