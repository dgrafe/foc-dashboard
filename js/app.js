import { createPublicClient, decodeFunctionResult, encodeFunctionData, http } from "https://esm.sh/viem@2?bundle";
import { getAccountSummary, getRail } from "https://esm.sh/@filoz/synapse-core@0.10.0/pay?bundle";
import { calibration, mainnet, PAGE_SIZE, DATASET_LOAD_CONCURRENCY, MAX_UINT256, MAX_TREE_SCAN_BYTES, MAX_TREE_NODES, CAR_HEADER_RANGE_BYTES, CAR_TAIL_INITIAL_RANGE_BYTES, CAR_TAIL_RANGE_BYTES, dataSetComponents, fwssAbi, pdpAbi, usdfcAbi, providerRegistryAbi } from "./constants.js";

let activeChain = mainnet;
let RPC_URL = mainnet.rpcUrls.default.http[0];
let FWSS_VIEW = mainnet.contracts.fwssView.address;
let PDP_VERIFIER = mainnet.contracts.pdp.address;
let PROVIDER_REGISTRY = mainnet.contracts.serviceProviderRegistry.address;
let USDFC_TOKEN = mainnet.contracts.usdfc.address;
let readClient = createPublicClient({ chain: mainnet, transport: http(RPC_URL) });
const form = document.getElementById("lookupForm");
const addressInput = document.getElementById("walletAddress");
const fetchButton = document.getElementById("fetchBtn");
const networkOptions = Array.from(document.querySelectorAll('input[name="network"]'));
const results = document.getElementById("results");
const accountOverview = document.getElementById("accountOverview");
const filBalance = document.getElementById("filBalance");
const usdfcBalance = document.getElementById("usdfcBalance");
const storageRunway = document.getElementById("storageRunway");
const totalMonthlyCost = document.getElementById("totalMonthlyCost");
const payTotalAmount = document.getElementById("payTotalAmount");
const payAvailableAmount = document.getElementById("payAvailableAmount");
const payLockedAmount = document.getElementById("payLockedAmount");

form.addEventListener("submit", (event) => {
    event.preventDefault();
    loadDatasets();
});

function getSelectedChain() {
    return networkOptions.find((option) => option.checked)?.value === "calibration" ? calibration : mainnet;
}

function getNetworkName(chain) {
    return chain.id === calibration.id ? "Filecoin Calibration" : "Filecoin Mainnet";
}

function configureNetwork(chain) {
    activeChain = chain;
    RPC_URL = chain.rpcUrls.default.http[0];
    FWSS_VIEW = chain.contracts.fwssView.address;
    PDP_VERIFIER = chain.contracts.pdp.address;
    PROVIDER_REGISTRY = chain.contracts.serviceProviderRegistry.address;
    USDFC_TOKEN = chain.contracts.usdfc.address;
    readClient = createPublicClient({ chain, transport: http(RPC_URL) });
}

function getNetworkPath() {
    return activeChain.id === calibration.id ? "calibration" : "mainnet";
}

function showMessage(message, isError = false) {
    const box = document.createElement("p");
    box.className = isError ? "message error" : "message";
    box.textContent = message;
    results.replaceChildren(box);
}

async function rpcRequest(method, params) {
    const response = await fetch(RPC_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            jsonrpc: "2.0",
            method,
            params,
            id: 1
        })
    });
    if (!response.ok) throw new Error(`RPC HTTP error ${response.status}`);
    const payload = await response.json();
    if (payload.error) throw new Error(payload.error.message || "RPC call failed");
    return payload.result;
}

async function rpcCall(to, abi, functionName, args) {
    const data = encodeFunctionData({ abi, functionName, args });
    const result = await rpcRequest("eth_call", [{ to, data }, "latest"]);
    if (!result || result === "0x") throw new Error("Empty response from smart contract");
    return decodeFunctionResult({ abi, functionName, data: result });
}

async function loadBalances(address) {
    accountOverview.hidden = false;
    filBalance.textContent = "Loading …";
    usdfcBalance.textContent = "Loading …";
    storageRunway.textContent = "Loading …";
    totalMonthlyCost.textContent = "Loading …";
    payTotalAmount.textContent = "Loading …";
    payAvailableAmount.textContent = "Loading …";
    payLockedAmount.textContent = "Loading …";
    const [filResult, usdfcResult, accountSummaryResult] = await Promise.allSettled([
        rpcRequest("eth_getBalance", [address, "latest"]).then((value) => formatUnits(BigInt(value), 18)),
        Promise.all([
            rpcCall(USDFC_TOKEN, usdfcAbi, "balanceOf", [address]),
            rpcCall(USDFC_TOKEN, usdfcAbi, "decimals", [])
        ]).then(([balance, decimals]) => formatUnitsFixed(BigInt(balance), Number(decimals))),
        getAccountSummary(readClient, { address })
    ]);
    if (addressInput.value.trim().toLowerCase() !== address.toLowerCase()) return;
    filBalance.textContent = filResult.status === "fulfilled" ? `${filResult.value} FIL` : "Unavailable";
    usdfcBalance.textContent = usdfcResult.status === "fulfilled" ? `${usdfcResult.value} USDFC` : "Unavailable";
    if (accountSummaryResult.status === "fulfilled") {
        const summary = accountSummaryResult.value;
        storageRunway.textContent = formatStorageHorizon(summary.runwayInEpochs, summary.lockupRatePerEpoch, summary.debt, true);
        totalMonthlyCost.textContent = `${formatUnitsRounded(summary.lockupRatePerMonth, 18)} USDFC/mo`;
        payTotalAmount.textContent = `${formatUnits(summary.funds, 18)} USDFC`;
        payAvailableAmount.textContent = `${formatUnits(summary.availableFunds, 18)} USDFC`;
        payLockedAmount.textContent = `${formatUnits(summary.totalLockup, 18)} USDFC`;
    } else {
        storageRunway.textContent = "Unavailable";
        totalMonthlyCost.textContent = "Unavailable";
        payTotalAmount.textContent = "Unavailable";
        payAvailableAmount.textContent = "Unavailable";
        payLockedAmount.textContent = "Unavailable";
        console.warn("Storage runway could not be loaded.", accountSummaryResult.reason);
    }
    if (filResult.status === "rejected") console.warn("FIL balance could not be loaded.", filResult.reason);
    if (usdfcResult.status === "rejected") console.warn("USDFC balance could not be loaded.", usdfcResult.reason);
}

async function fetchAllDataSets(address) {
    const dataSets = [];
    for (let offset = 0n; offset < 50000n; offset += PAGE_SIZE) {
        const page = await rpcCall(FWSS_VIEW, fwssAbi, "getClientDataSets", [address, offset, PAGE_SIZE]);
        dataSets.push(...page);
        if (page.length < Number(PAGE_SIZE)) return dataSets;
    }
    throw new Error("The account has more than 50,000 datasets; stopped for safety.");
}

async function fetchPiecePage(dataSetId, cursor) {
    return rpcCall(PDP_VERIFIER, pdpAbi, "getActivePiecesByCursor", [dataSetId, cursor, PAGE_SIZE]);
}

async function getDatasetFeatures(dataSetId) {
    const [keys] = await rpcCall(FWSS_VIEW, fwssAbi, "getAllDataSetMetadata", [dataSetId]);
    return {
        ipfsIndexing: keys.includes("withIPFSIndexing"),
        cdn: keys.includes("withCDN")
    };
}

async function getProviderServiceUrl(providerId) {
    const provider = await rpcCall(PROVIDER_REGISTRY, providerRegistryAbi, "getProviderWithProduct", [providerId, 0]);
    if (!provider.product.isActive) return null;
    const urlIndex = provider.product.capabilityKeys.indexOf("serviceURL");
    if (urlIndex < 0 || !provider.productCapabilityValues[urlIndex]) return null;
    const serviceUrl = new TextDecoder().decode(hexToBytes(provider.productCapabilityValues[urlIndex]));
    const parsedUrl = new URL(serviceUrl);
    if (parsedUrl.protocol !== "https:" && parsedUrl.protocol !== "http:") return null;
    return serviceUrl;
}

async function loadDatasets() {
    const address = addressInput.value.trim();
    if (!/^0x[\da-fA-F]{40}$/.test(address)) {
        addressInput.setCustomValidity("Enter a valid 0x address with 40 hexadecimal characters.");
        addressInput.reportValidity();
        return;
    }
    addressInput.setCustomValidity("");
    configureNetwork(getSelectedChain());
    loadBalances(address);
    fetchButton.disabled = true;
    fetchButton.textContent = "Loading data …";
    networkOptions.forEach((option) => { option.disabled = true; });
    results.setAttribute("aria-busy", "true");
    showMessage(`Reading datasets from ${getNetworkName(activeChain)} and loading piece lists …`);

    try {
        const dataSets = await fetchAllDataSets(address);
        if (dataSets.length === 0) {
            showMessage("No FWSS datasets were found for this address.");
            return;
        }

        const monthlyCostsPromise = calculateDatasetMonthlyCosts(dataSets);

        const datasetPanel = document.createElement("div");
        datasetPanel.id = "datasetPanel";
        results.replaceChildren(datasetPanel);

        const summary = document.createElement("div");
        summary.className = "summary";
        const heading = document.createElement("h2");
        heading.textContent = "Stored datasets";
        const count = document.createElement("span");
        count.textContent = `${dataSets.length} ${dataSets.length === 1 ? "Dataset" : "Datasets"}`;
        summary.append(heading, count);
        datasetPanel.appendChild(summary);

        const pieceIndex = new Map();
        const cards = dataSets.map((dataSet) => {
            const card = createDatasetCard(dataSet);
            datasetPanel.appendChild(card.element);
            return card;
        });
        let nextDataSetIndex = 0;
        const workers = Array.from({ length: Math.min(DATASET_LOAD_CONCURRENCY, dataSets.length) }, async () => {
            while (nextDataSetIndex < dataSets.length) {
                const index = nextDataSetIndex++;
                await populateDataset(cards[index], dataSets[index], address, pieceIndex, monthlyCostsPromise);
            }
        });
        await Promise.all(workers);
    } catch (error) {
        showMessage(`Request failed: ${error.message}. Check the RPC connection or whether the provider allows browser requests (CORS).`, true);
    } finally {
        fetchButton.disabled = false;
        fetchButton.textContent = "Look up address";
        networkOptions.forEach((option) => { option.disabled = false; });
        results.setAttribute("aria-busy", "false");
    }
}

function createDatasetCard(dataSet) {
    const element = document.createElement("details");
    element.className = "dataset";
    const header = document.createElement("summary");
    header.className = "dataset-head";
    const identity = document.createElement("div");
    const title = document.createElement("h3");
    title.textContent = `Dataset: ${dataSet.dataSetId}`;
    const provider = document.createElement("div");
    provider.className = "dataset-meta";
    provider.textContent = `Storage Provider: ${dataSet.serviceProvider}`;
    const endpoint = document.createElement("div");
    endpoint.className = "dataset-meta dataset-endpoint";
    endpoint.hidden = true;
    const rail = document.createElement("div");
    rail.className = "dataset-meta dataset-endpoint";
    const railLink = document.createElement("a");
    railLink.href = `https://pay.filecoin.cloud/${getNetworkPath()}/rails/${dataSet.pdpRailId}`;
    railLink.target = "_blank";
    railLink.rel = "noopener noreferrer";
    railLink.textContent = dataSet.pdpRailId.toString();
    railLink.title = "Open payment rail on Filecoin Pay";
    rail.append("Payment Rail: ", railLink);
    const features = document.createElement("div");
    features.className = "dataset-features";
    renderDatasetFeatures(features, null);
    identity.append(title, provider, endpoint, rail, features);
    const badge = document.createElement("span");
    badge.className = "piece-count";
    badge.textContent = "Pieces: Loading …";
    header.append(identity, badge);
    const pieces = document.createElement("div");
    pieces.className = "pieces";
    element.append(header, pieces);
    return { element, badge, pieces, features, endpoint };
}

function renderDatasetFeatures(container, features) {
    container.replaceChildren();
    for (const [label, active] of [["IPFS Indexing", features?.ipfsIndexing], ["CDN", features?.cdn]]) {
        const badge = document.createElement("span");
        badge.className = `dataset-feature ${active === undefined ? "unknown" : active ? "active" : "inactive"}`;
        badge.textContent = `${label}: ${active === undefined ? "Checking …" : active ? "Active" : "Inactive"}`;
        container.appendChild(badge);
    }
}

async function populateDataset(card, dataSet, address, pieceIndex, monthlyCostsPromise) {
    let providerServiceUrl = null;
    let cdnEnabled = false;
    try {
        providerServiceUrl = await getProviderServiceUrl(dataSet.providerId);
        if (providerServiceUrl) {
            const serviceUrl = new URL(providerServiceUrl);
            const link = document.createElement("a");
            link.href = `https://pdp.filecoin.cloud/${getNetworkPath()}/providers/${dataSet.serviceProvider.toLowerCase()}`;
            link.target = "_blank";
            link.rel = "noopener noreferrer";
            link.textContent = serviceUrl.origin;
            link.title = "Open provider entry on PDP Explorer";
            card.endpoint.append(document.createTextNode("Provider Endpoint: "), link);
            card.endpoint.hidden = false;
        }
    } catch (error) {
        console.warn(`Could not resolve storage provider for dataset ${dataSet.dataSetId}.`, error);
    }
    try {
        const features = await getDatasetFeatures(dataSet.dataSetId);
        cdnEnabled = BigInt(dataSet.cdnRailId) > 0n && features.cdn;
        renderDatasetFeatures(card.features, { ipfsIndexing: features.ipfsIndexing, cdn: cdnEnabled });
    } catch (error) {
        console.warn(`Could not read IPFS/CDN metadata for dataset ${dataSet.dataSetId}.`, error);
    }

    let cursor = 0n;
    let pieceCount = 0;
    let totalPieceSize = 0n;
    let unknownSizeCount = 0;
    let monthlyCostLabel = "monthly cost unavailable";
    try {
        const { labels } = await monthlyCostsPromise;
        monthlyCostLabel = labels.get(dataSet.dataSetId) || monthlyCostLabel;
    } catch (error) {
        console.warn(`Could not estimate monthly cost for dataset ${dataSet.dataSetId}.`, error);
    }
    try {
        while (pieceCount < 50000) {
            const [pieces, ids, hasMore] = await fetchPiecePage(dataSet.dataSetId, cursor);
            for (let index = 0; index < pieces.length; index++) {
                const piece = {
                    cid: pieceBytesToCid(pieces[index].data),
                    size: piecePayloadSizeFromBytes(pieces[index].data),
                    id: ids[index]
                };
                const cdnUrl = cdnEnabled ? `https://${address.toLowerCase()}.${activeChain.filbeam.retrievalDomain}/${piece.cid}` : null;
                const providerUrl = providerServiceUrl ? new URL(`piece/${piece.cid}`, providerServiceUrl).toString() : null;
                const indexedPieceOccurrence = addPieceToIndex(pieceIndex, piece, dataSet.dataSetId, providerServiceUrl, cdnUrl);
                const row = createPieceRow(piece, pieceCount, providerUrl, cdnUrl, providerServiceUrl, cdnEnabled, indexedPieceOccurrence.indexedPiece);
                row.element.id = `piece-${dataSet.dataSetId}-${piece.id}`;
                indexedPieceOccurrence.occurrence.duplicateReference = row.duplicateReference;
                updatePieceDuplicateReferences(indexedPieceOccurrence.indexedPiece);
                card.pieces.appendChild(row.element);
                pieceCount++;
                if (piece.size === null) unknownSizeCount++;
                else totalPieceSize += piece.size;
                readCarRoot(row.result, piece.cid, providerServiceUrl, cdnUrl);
            }
            if (!hasMore || pieces.length === 0) break;
            cursor = ids[ids.length - 1] + 1n;
        }
        updateDatasetBadge(card.badge, pieceCount, totalPieceSize, unknownSizeCount, false, monthlyCostLabel);
        if (pieceCount === 0) addEmptyPieces(card.pieces, "No active pieces in this dataset.");
        if (pieceCount >= 50000) addEmptyPieces(card.pieces, "Display limited to 50,000 pieces.");
    } catch (error) {
        if (pieceCount) updateDatasetBadge(card.badge, pieceCount, totalPieceSize, unknownSizeCount, true, monthlyCostLabel);
        else card.badge.textContent = "Pieces: Unavailable";
        addEmptyPieces(card.pieces, `Piece query failed: ${error.message}`);
    }
}

function updateDatasetBadge(badge, pieceCount, totalSize, unknownSizeCount, partial = false, monthlyCostLabel = "monthly cost unavailable") {
    const sizeLabel = unknownSizeCount ? `At Least ${formatBytes(totalSize)}` : formatBytes(totalSize);
    badge.textContent = `Pieces: ${pieceCount} · Size: ${sizeLabel} · Cost: ${monthlyCostLabel}${partial ? " · Partial" : ""}`;
    badge.title = `Current Filecoin Pay PDP rail rate, expressed per 86,400 epochs.${unknownSizeCount ? ` Size unavailable for ${unknownSizeCount} piece${unknownSizeCount === 1 ? "" : "s"}.` : ""}`;
}

async function calculateDatasetMonthlyCosts(dataSets) {
    const costs = await Promise.all(dataSets.map(async (dataSet) => {
        if (dataSet.pdpEndEpoch > 0n) return { dataSetId: dataSet.dataSetId, label: "storage terminated", amount: 0n };
        try {
            const rail = await getRail(readClient, { railId: dataSet.pdpRailId });
            const amount = rail.paymentRate * 86400n;
            return { dataSetId: dataSet.dataSetId, label: `${formatUnitsRounded(amount, 18)} USDFC/mo`, amount };
        } catch (error) {
            console.warn(`Could not read Filecoin Pay rate for dataset ${dataSet.dataSetId}.`, error);
            return { dataSetId: dataSet.dataSetId, label: "monthly cost unavailable", amount: null };
        }
    }));
    return {
        labels: new Map(costs.map(({ dataSetId, label }) => [dataSetId, label]))
    };
}

function addPieceToIndex(index, piece, dataSetId, providerServiceUrl, cdnUrl) {
    let indexedPiece = index.get(piece.cid);
    if (!indexedPiece) {
        indexedPiece = { cid: piece.cid, size: piece.size, datasets: [], sources: [], fileTree: null, fileTreePromise: null };
        index.set(piece.cid, indexedPiece);
    } else if (indexedPiece.size === null && piece.size !== null) {
        indexedPiece.size = piece.size;
    }
    const occurrence = { dataSetId, pieceId: piece.id, duplicateReference: null };
    indexedPiece.datasets.push(occurrence);
    const providerUrl = providerServiceUrl ? new URL(`piece/${piece.cid}`, providerServiceUrl).toString() : null;
    if (!indexedPiece.sources.some((source) => source.providerUrl === providerUrl && source.cdnUrl === cdnUrl)) {
        indexedPiece.sources.push({ providerUrl, cdnUrl });
    }
    return { indexedPiece, occurrence };
}

function updatePieceDuplicateReferences(indexedPiece) {
    if (indexedPiece.datasets.length < 2) return;
    for (const occurrence of indexedPiece.datasets) {
        if (!occurrence.duplicateReference) continue;
        const copies = indexedPiece.datasets
            .filter((candidate) => candidate !== occurrence)
            .map((candidate) => ({
                label: `Dataset ${candidate.dataSetId} · PieceID ${candidate.pieceId}`,
                targetId: `piece-${candidate.dataSetId}-${candidate.pieceId}`
            }));
        occurrence.duplicateReference.replaceChildren(document.createTextNode(`${copies.length === 1 ? "Copy" : "Copies"} in `));
        copies.forEach((copy, index) => {
            if (index > 0) occurrence.duplicateReference.append(document.createTextNode("; "));
            const link = document.createElement("a");
            link.href = `#${copy.targetId}`;
            link.textContent = copy.label;
            link.addEventListener("click", (event) => {
                event.preventDefault();
                const target = document.getElementById(copy.targetId);
                if (!target) return;
                const targetDataset = target.closest("details.dataset");
                if (targetDataset) targetDataset.open = true;
                requestAnimationFrame(() => target.scrollIntoView({ behavior: "smooth", block: "center" }));
            });
            occurrence.duplicateReference.appendChild(link);
        });
        occurrence.duplicateReference.hidden = false;
    }
}

function createFileTreeDetails(piece) {
    const details = document.createElement("details");
    details.className = "filesystem";
    const summary = document.createElement("summary");
    summary.textContent = "Load UnixFS file tree";
    const content = document.createElement("div");
    content.className = "filesystem-content";
    details.append(summary, content);

    details.addEventListener("toggle", () => {
        if (!details.open) return;
        if (piece.fileTree) {
            renderUnixFsTree(content, piece.fileTree);
            return;
        }
        if (details.dataset.loading === "true") return;
        details.dataset.loading = "true";
        content.textContent = "Reading CAR directory blocks …";
        if (!piece.fileTreePromise) piece.fileTreePromise = fetchUnixFsFileTree(piece);
        piece.fileTreePromise.then((tree) => {
            piece.fileTree = tree;
            renderUnixFsTree(content, tree);
        }).catch((error) => {
            piece.fileTreePromise = null;
            content.replaceChildren();
            const message = document.createElement("span");
            message.className = "failure";
            message.textContent = `File tree unavailable: ${error.message}`;
            content.appendChild(message);
        }).finally(() => {
            details.dataset.loading = "false";
        });
    });
    return details;
}

async function fetchUnixFsFileTree(piece) {
    const errors = [];
    const attempted = new Set();
    for (const source of piece.sources) {
        if (source.providerUrl && !attempted.has(source.providerUrl)) {
            attempted.add(source.providerUrl);
            try {
                return { source: "Storage provider", ...await scanUnixFsCar(source.providerUrl, piece.size) };
            } catch (error) {
                errors.push(`Provider: ${error.message}`);
            }
        }
        if (source.cdnUrl && !attempted.has(source.cdnUrl)) {
            attempted.add(source.cdnUrl);
            try {
                return { source: "FilBeam", ...await scanUnixFsCar(source.cdnUrl, piece.size) };
            } catch (error) {
                errors.push(`FilBeam: ${error.message}`);
            }
        }
    }
    throw new Error(errors.join("; ") || "No provider or CDN endpoint is available.");
}

async function scanUnixFsCar(url, pieceSize) {
    const [{ CarBlockIterator }, UnixFS, dagPb, legacyUnixFS] = await Promise.all([
        import("https://esm.sh/@ipld/car@5?bundle"),
        import("https://esm.sh/@ipld/unixfs@3?bundle"),
        import("https://esm.sh/@ipld/dag-pb@4?bundle"),
        import("https://esm.sh/ipfs-unixfs@11?bundle")
    ]);
    const firstRange = await fetch(url, { headers: { Range: `bytes=0-${CAR_HEADER_RANGE_BYTES - 1}` } });
    if (firstRange.status === 200) return scanUnixFsCarStream(firstRange, CarBlockIterator, UnixFS, dagPb, legacyUnixFS);
    if (firstRange.status !== 206) throw new Error(`HTTP ${firstRange.status}`);

    const header = parseCarHeader(new Uint8Array(await firstRange.arrayBuffer()));
    const totalLength = Number(pieceSize);
    if (Number.isSafeInteger(totalLength) && totalLength > header.dataOffset) {
        const maxTailBytes = Math.min(CAR_TAIL_RANGE_BYTES, totalLength - header.dataOffset);
        let tailBytesCount = Math.min(CAR_TAIL_INITIAL_RANGE_BYTES, maxTailBytes);
        const [{ CID }, { sha256 }] = await Promise.all([
            import("https://esm.sh/multiformats@13/cid?bundle"),
            import("https://esm.sh/multiformats@13/hashes/sha2?bundle")
        ]);
        const roots = header.roots.map((root) => CID.parse(root));

        while (tailBytesCount > 0) {
            const tailStart = totalLength - tailBytesCount;
            const tailRange = await fetch(url, { headers: { Range: `bytes=${tailStart}-${totalLength - 1}` } });
            if (tailRange.status === 200) {
                await tailRange.body?.cancel().catch(() => {});
                break;
            }
            if (tailRange.status !== 206) throw new Error(`Tail-Range-HTTP ${tailRange.status}`);

            const tailBytes = new Uint8Array(await tailRange.arrayBuffer());
            const state = createUnixFsState(roots);
            while (state.pending.size > 0) {
                let foundBlock = false;
                for (const cid of Array.from(state.pending.values())) {
                    const block = await findCarBlockInTail(tailBytes, tailStart, totalLength, cid, sha256);
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
    }

    const response = await fetch(url);
    if (response.status !== 200 && response.status !== 206) throw new Error(`HTTP ${response.status}`);
    return scanUnixFsCarStream(response, CarBlockIterator, UnixFS, dagPb, legacyUnixFS);
}

async function findCarBlockInTail(bytes, absoluteStart, totalLength, cid, sha256) {
    const target = cid.bytes;
    for (let index = 0; index <= bytes.length - target.length; index++) {
        let matches = true;
        for (let byteIndex = 0; byteIndex < target.length; byteIndex++) {
            if (bytes[index + byteIndex] !== target[byteIndex]) {
                matches = false;
                break;
            }
        }
        if (!matches) continue;

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
    if (iterator.version !== 1) throw new Error("Only CARv1 is supported.");
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

function renderUnixFsTree(container, tree) {
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

function createPieceRow(piece, index, providerUrl, cdnUrl, providerServiceUrl, cdnEnabled, indexedPiece) {
    const element = document.createElement("div");
    element.className = "piece";
    const identity = document.createElement("div");
    const heading = document.createElement("div");
    heading.className = "piece-heading";
    const pieceTitle = document.createElement("span");
    pieceTitle.className = "piece-title";
    pieceTitle.textContent = `PieceID ${piece.id} · ${piece.size === null ? "size unavailable" : formatBytes(piece.size)}`;
    const duplicateReference = document.createElement("span");
    duplicateReference.className = "piece-duplicate-reference";
    duplicateReference.hidden = true;
    heading.append(pieceTitle, duplicateReference);

    const linksLine = document.createElement("div");
    linksLine.className = "piece-links";
    const cid = document.createElement("div");
    cid.className = "piece-cid";
    const cidLabel = document.createElement("span");
    cidLabel.className = "piece-link-label";
    cidLabel.textContent = "Piece CID:";
    const pieceCid = document.createElement("span");
    pieceCid.className = "piece-hash";
    pieceCid.textContent = piece.cid;
    const pieceCopyControl = createHashCopyControl(piece.cid, "Copy Piece CID to clipboard");
    cid.append(cidLabel, pieceCid, pieceCopyControl.button, pieceCopyControl.status);

    const downloads = document.createElement("div");
    downloads.className = "piece-downloads";
    if (cdnUrl) downloads.appendChild(createDownloadLink(cdnUrl, "Download from CDN", "CDN"));
    if (providerUrl) downloads.appendChild(createDownloadLink(providerUrl, "Download from storage provider", "Provider"));
    linksLine.appendChild(cid);
    if (downloads.childElementCount > 0) linksLine.appendChild(downloads);
    identity.append(heading, linksLine);

    const result = document.createElement("div");
    result.className = "piece-result";
    const rootInfo = document.createElement("div");
    rootInfo.className = "piece-root";
    const rootLinks = document.createElement("div");
    rootLinks.className = "piece-root-links";
    rootInfo.textContent = providerServiceUrl
        ? "Trying storage provider · reading up to 200 bytes …"
        : cdnEnabled ? "Provider unavailable · trying CDN …" : "";
    result.append(rootInfo, rootLinks);
    element.append(identity, result, createFileTreeDetails(indexedPiece));
    return { element, result: rootInfo, duplicateReference };
}

function createHashCopyControl(hash, label) {
    const button = document.createElement("button");
    button.className = "copy-hash-button";
    button.type = "button";
    button.setAttribute("aria-label", label);
    button.title = label;

    const icon = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    icon.setAttribute("viewBox", "0 0 24 24");
    icon.setAttribute("fill", "none");
    icon.setAttribute("stroke", "currentColor");
    icon.setAttribute("stroke-width", "2");
    icon.setAttribute("stroke-linecap", "round");
    icon.setAttribute("stroke-linejoin", "round");
    icon.setAttribute("aria-hidden", "true");
    const frontSheet = document.createElementNS("http://www.w3.org/2000/svg", "rect");
    frontSheet.setAttribute("width", "14");
    frontSheet.setAttribute("height", "14");
    frontSheet.setAttribute("x", "8");
    frontSheet.setAttribute("y", "8");
    frontSheet.setAttribute("rx", "2");
    const backSheet = document.createElementNS("http://www.w3.org/2000/svg", "path");
    backSheet.setAttribute("d", "M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2v2");
    icon.append(frontSheet, backSheet);
    button.appendChild(icon);

    const status = document.createElement("span");
    status.className = "piece-copy-status";
    status.setAttribute("aria-live", "polite");
    button.addEventListener("click", () => copyPieceCid(hash, status));
    return { button, status };
}

function createDownloadLink(url, label, source, iconText = "download") {
    const link = document.createElement("a");
    link.className = "download-icon";
    if (source === "Provider") link.classList.add("download-provider");
    link.href = url;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    link.setAttribute("aria-label", label);
    link.title = label;
    const icon = document.createElement("span");
    icon.setAttribute("aria-hidden", "true");
    if (iconText === "external") {
        const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
        svg.setAttribute("viewBox", "0 0 24 24");
        svg.setAttribute("fill", "none");
        svg.setAttribute("stroke", "currentColor");
        svg.setAttribute("stroke-width", "2");
        svg.setAttribute("stroke-linecap", "round");
        svg.setAttribute("stroke-linejoin", "round");
        svg.setAttribute("aria-hidden", "true");
        const frame = document.createElementNS("http://www.w3.org/2000/svg", "path");
        frame.setAttribute("d", "M13 5h6v6M19 5l-9 9M19 13v5a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h5");
        svg.appendChild(frame);
        icon.appendChild(svg);
    } else if (iconText === "download") {
        const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
        svg.setAttribute("viewBox", "0 0 24 24");
        svg.setAttribute("fill", "none");
        svg.setAttribute("stroke", "currentColor");
        svg.setAttribute("stroke-width", "2");
        svg.setAttribute("stroke-linecap", "round");
        svg.setAttribute("stroke-linejoin", "round");
        svg.setAttribute("aria-hidden", "true");
        const tray = document.createElementNS("http://www.w3.org/2000/svg", "path");
        tray.setAttribute("d", "M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4");
        const arrow = document.createElementNS("http://www.w3.org/2000/svg", "path");
        arrow.setAttribute("d", "m7 10 5 5 5-5M12 15V3");
        svg.append(tray, arrow);
        icon.appendChild(svg);
    } else {
        icon.textContent = iconText;
    }
    const sourceLabel = document.createElement("span");
    sourceLabel.className = "download-source";
    sourceLabel.textContent = source;
    link.append(icon, sourceLabel);
    return link;
}

async function copyPieceCid(cid, status) {
    try {
        if (navigator.clipboard?.writeText) {
            await navigator.clipboard.writeText(cid);
        } else {
            const field = document.createElement("textarea");
            field.value = cid;
            field.style.position = "fixed";
            field.style.opacity = "0";
            document.body.appendChild(field);
            field.select();
            const copied = document.execCommand("copy");
            field.remove();
            if (!copied) throw new Error("Clipboard unavailable");
        }
        status.textContent = "Copied";
        setTimeout(() => { status.textContent = ""; }, 1800);
    } catch {
        status.textContent = "Could not copy";
    }
}

function addEmptyPieces(container, message) {
    const line = document.createElement("p");
    line.className = "piece-result pending";
    line.textContent = message;
    container.appendChild(line);
}

function setResult(container, message, kind) {
    container.replaceChildren();
    const text = document.createElement("span");
    text.className = kind;
    text.textContent = message;
    container.appendChild(text);
}

async function readCarRoot(container, pieceCid, providerServiceUrl, cdnUrl) {
    let providerError = null;
    if (providerServiceUrl) {
        try {
            const providerUrl = new URL(`piece/${pieceCid}`, providerServiceUrl).toString();
            const roots = await fetchCarRoots(providerUrl);
            renderCarRoots(container, roots, "Storage provider");
            return { roots, source: "Storage provider" };
        } catch (error) {
            providerError = error;
        }
    }

    if (cdnUrl) {
        try {
            const roots = await fetchCarRoots(cdnUrl);
            const source = providerError ? "FilBeam · provider unavailable" : "FilBeam";
            renderCarRoots(container, roots, source);
            return { roots, source };
        } catch (error) {
            const providerMessage = providerError ? `Provider: ${providerError.message}; ` : "";
            const message = `${providerMessage}CDN: ${error.message}`;
            setResult(container, message, "failure");
            return { error: message };
        }
    }

    const message = `Storage provider: ${providerError?.message || "no PDP endpoint registered"}; CDN is not enabled.`;
    setResult(container, message, "failure");
    return { error: message };
}

async function fetchCarRoots(url) {
    const response = await fetch(url, { headers: { Range: "bytes=0-199" } });
    if (response.status !== 200 && response.status !== 206) {
        throw new Error(`HTTP ${response.status}`);
    }
    return parseCarRoots(await readAtMost(response, 200));
}

function renderCarRoots(container, roots, source) {
    container.replaceChildren();
    container.classList.add("has-roots");
    const explorerLinks = container.parentElement.querySelector(".piece-root-links");
    explorerLinks?.replaceChildren();
    const caption = document.createElement("span");
    caption.className = "piece-link-label";
    caption.textContent = "CAR root: ";
    caption.title = `Read from ${source}`;
    container.appendChild(caption);
    roots.forEach((root, index) => {
        if (index > 0) container.append(document.createTextNode(", "));
        const rootHash = document.createElement("span");
        rootHash.className = "piece-root-hash";
        rootHash.textContent = root;
        const rootCopyControl = createHashCopyControl(root, "Copy CAR root CID to clipboard");
        container.append(rootHash, rootCopyControl.button, rootCopyControl.status);

        if (explorerLinks) {
            explorerLinks.appendChild(createDownloadLink(
                `https://inbrowser.link/ipfs/${root}`,
                `Open CAR root ${root} on inbrowser.link`,
                "inbrowser",
                "external"
            ));
        }
    });
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

function parseCarRoots(bytes) {
    return parseCarHeader(bytes).roots;
}

function parseCarHeader(bytes) {
    const frame = readVarint(bytes, 0);
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

function pieceBytesToCid(hex) {
    const bytes = hexToBytes(hex);
    const version = readVarint(bytes, 0);
    if (version.value !== 1) throw new Error("Piece CID is not CIDv1.");
    return `b${base32(bytes)}`;
}

function piecePayloadSizeFromBytes(hex) {
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

function hexToBytes(hex) {
    const clean = hex.startsWith("0x") ? hex.slice(2) : hex;
    if (!clean || clean.length % 2 !== 0 || !/^[\da-f]+$/i.test(clean)) {
        throw new Error("Invalid piece CID returned by the contract.");
    }
    return Uint8Array.from({ length: clean.length / 2 }, (_, index) => parseInt(clean.slice(index * 2, index * 2 + 2), 16));
}

function formatBytes(size) {
    const units = ["B", "KiB", "MiB", "GiB", "TiB", "PiB"];
    let value = Number(size);
    let unit = 0;
    while (value >= 1024 && unit < units.length - 1) {
        value /= 1024;
        unit++;
    }
    return `${unit === 0 ? value : value.toFixed(2)} ${units[unit]}`;
}

function formatUnits(value, decimals, maxFractionDigits = 4) {
    const scale = 10n ** BigInt(decimals);
    const integer = (value / scale).toLocaleString("de-DE");
    const fraction = (value % scale).toString().padStart(decimals, "0").slice(0, maxFractionDigits).replace(/0+$/, "");
    return fraction ? `${integer},${fraction}` : integer;
}

function formatUnitsFixed(value, decimals, fractionDigits = 4) {
    const scale = 10n ** BigInt(decimals);
    const displayScale = 10n ** BigInt(fractionDigits);
    const rounded = (value * displayScale + scale / 2n) / scale;
    const integer = (rounded / displayScale).toLocaleString("de-DE");
    const fraction = (rounded % displayScale).toString().padStart(fractionDigits, "0");
    return `${integer},${fraction}`;
}

function formatUnitsRounded(value, decimals, maxFractionDigits = 4) {
    const precision = 10n ** BigInt(Math.max(0, decimals - maxFractionDigits));
    const rounded = ((value + precision / 2n) / precision) * precision;
    return formatUnits(rounded, decimals, maxFractionDigits);
}

function formatStorageHorizon(epochs, ratePerEpoch, debt = 0n, isRunway = true) {
    if (ratePerEpoch === 0n || epochs >= MAX_UINT256) return "No active storage spend";
    if (isRunway && debt > 0n) return "In deficit · top-up required";
    if (epochs === 0n) return isRunway ? "0 days · top-up required" : "0 days";
    if (epochs > BigInt(Number.MAX_SAFE_INTEGER)) return "Very long runway";

    const days = epochs / 2880n;
    const hours = (epochs % 2880n) / 120n;
    const duration = days > 0n ? `${days} days ${hours} hr` : `${hours} hr`;
    const estimatedEnd = new Date(Date.now() + Number(epochs) * 30_000);
    const date = new Intl.DateTimeFormat("en-US", { dateStyle: "medium" }).format(estimatedEnd);
    return `${duration} · until approx. ${date}`;
}
