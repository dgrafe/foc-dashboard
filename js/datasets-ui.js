import { pieceBytesToCid, piecePayloadSizeFromBytes } from "./car.js";
import { formatBytes } from "./format.js";
import { addPieceToIndex } from "./piece-index.js";
import { MAX_PIECES, PIECE_RENDER_CHUNK } from "./limits.js";
import { PAY_EXPLORER_URL, PDP_EXPLORER_URL } from "./constants.js";
import { state, getNetworkPath } from "./state.js";
import { fetchPiecePage, getDatasetFeatures, getProviderServiceUrl } from "./chain-api.js";
import { addEmptyPieces, keepLinkInteractive } from "./ui-widgets.js";
import { carQueue, renderMoreRows, rowRegistry, updatePieceDuplicateReferences } from "./pieces-ui.js";

export function createDatasetCard(dataSet) {
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
    railLink.href = `${PAY_EXPLORER_URL}/${getNetworkPath()}/rails/${dataSet.pdpRailId}`;
    railLink.target = "_blank";
    railLink.rel = "noopener noreferrer";
    railLink.textContent = dataSet.pdpRailId.toString();
    railLink.title = "Open payment rail on Filecoin Pay";
    rail.append("Payment Rail: ", keepLinkInteractive(railLink));
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
    const rowsHost = document.createElement("div");
    const moreBar = document.createElement("div");
    moreBar.className = "piece-more";
    moreBar.hidden = true;
    pieces.append(rowsHost, moreBar);
    element.append(header, pieces);
    return { element, badge, pieces, rowsHost, moreBar, rows: [], rendered: 0, features, endpoint };
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

export async function populateDataset(card, dataSet, address, pieceIndex, monthlyCostsPromise, isStale = () => false) {
    let providerServiceUrl = null;
    let cdnEnabled = false;
    try {
        providerServiceUrl = await getProviderServiceUrl(dataSet.providerId);
        if (providerServiceUrl) {
            const serviceUrl = new URL(providerServiceUrl);
            const link = document.createElement("a");
            link.href = `${PDP_EXPLORER_URL}/${getNetworkPath()}/providers/${dataSet.serviceProvider.toLowerCase()}`;
            link.target = "_blank";
            link.rel = "noopener noreferrer";
            link.textContent = serviceUrl.origin;
            link.title = "Open provider entry on PDP Explorer";
            card.endpoint.append(document.createTextNode("Provider Endpoint: "), keepLinkInteractive(link));
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
    let piecesLoaded = false;
    const dirtyPieces = new Set();
    try {
        while (pieceCount < MAX_PIECES) {
            const [pieces, ids, hasMore] = await fetchPiecePage(dataSet.dataSetId, cursor);
            if (isStale()) return;
            for (let index = 0; index < pieces.length; index++) {
                const piece = {
                    cid: pieceBytesToCid(pieces[index].data),
                    size: piecePayloadSizeFromBytes(pieces[index].data),
                    id: ids[index]
                };
                const cdnUrl = cdnEnabled ? `https://${address.toLowerCase()}.${state.chain.filbeam.retrievalDomain}/${piece.cid}` : null;
                const providerUrl = providerServiceUrl ? new URL(`piece/${piece.cid}`, providerServiceUrl).toString() : null;
                const indexedPieceOccurrence = addPieceToIndex(pieceIndex, piece, dataSet.dataSetId, providerServiceUrl, cdnUrl);
                const rootState = { status: "queued", container: null };
                const rowData = {
                    piece, providerUrl, cdnUrl, providerServiceUrl, cdnEnabled, rootState,
                    indexedPiece: indexedPieceOccurrence.indexedPiece,
                    occurrence: indexedPieceOccurrence.occurrence
                };
                rowRegistry.set(`piece-${dataSet.dataSetId}-${piece.id}`, { card, index: card.rows.length });
                card.rows.push(rowData);
                dirtyPieces.add(indexedPieceOccurrence.indexedPiece);
                card.rootLoads.push(carQueue.enqueue(rootState, piece.cid, providerServiceUrl, cdnUrl));
                pieceCount++;
                if (piece.size === null) unknownSizeCount++;
                else totalPieceSize += piece.size;
            }
            if (!hasMore || pieces.length === 0) break;
            cursor = ids[ids.length - 1] + 1n;
        }
        piecesLoaded = true;
    } catch (error) {
        if (isStale()) return;
        if (pieceCount) updateDatasetBadge(card.badge, pieceCount, totalPieceSize, unknownSizeCount, true, monthlyCostLabel);
        else card.badge.textContent = "Pieces: Unavailable";
        addEmptyPieces(card.pieces, `Piece query failed: ${error.message}`);
    }
    // Rows are rendered lazily in chunks; duplicate references are refreshed once per dataset.
    renderMoreRows(card, PIECE_RENDER_CHUNK);
    dirtyPieces.forEach(updatePieceDuplicateReferences);
    if (!piecesLoaded) return;

    try {
        const { labels } = await monthlyCostsPromise;
        monthlyCostLabel = labels.get(dataSet.dataSetId) || monthlyCostLabel;
    } catch (error) {
        console.warn(`Could not estimate monthly cost for dataset ${dataSet.dataSetId}.`, error);
    }
    if (isStale()) return;
    updateDatasetBadge(card.badge, pieceCount, totalPieceSize, unknownSizeCount, false, monthlyCostLabel);
    if (pieceCount === 0) addEmptyPieces(card.pieces, "No active pieces in this dataset.");
    if (pieceCount >= MAX_PIECES) addEmptyPieces(card.pieces, `Display limited to ${MAX_PIECES.toLocaleString("en-US")} pieces.`);
    await Promise.all(card.rootLoads);
}

function updateDatasetBadge(badge, pieceCount, totalSize, unknownSizeCount, partial = false, monthlyCostLabel = "monthly cost unavailable") {
    const sizeLabel = unknownSizeCount ? `At Least ${formatBytes(totalSize)}` : formatBytes(totalSize);
    badge.textContent = `Pieces: ${pieceCount} · Size: ${sizeLabel} · Cost: ${monthlyCostLabel}${partial ? " · Partial" : ""}`;
    badge.title = `Current Filecoin Pay PDP rail rate, expressed per 86,400 epochs.${unknownSizeCount ? ` Size unavailable for ${unknownSizeCount} piece${unknownSizeCount === 1 ? "" : "s"}.` : ""}`;
}
