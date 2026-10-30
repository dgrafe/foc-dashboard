import { pieceBytesToCid, piecePayloadSizeFromBytes } from "./car.js";
import { t, localeTag, errorText } from "./i18n.js";
import { bindText, bindAttr, bindDom } from "./i18n-ui.js";
import { formatBytes, formatUnitsRounded } from "./format.js";
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
    const provider = document.createElement("div");
    provider.className = "dataset-meta";
    const endpoint = document.createElement("div");
    endpoint.className = "dataset-meta dataset-endpoint";
    const rail = document.createElement("div");
    rail.className = "dataset-meta dataset-endpoint";
    const railPrefix = document.createElement("span");
    const railLink = document.createElement("a");
    railLink.href = `${PAY_EXPLORER_URL}/${getNetworkPath()}/rails/${dataSet.pdpRailId}`;
    railLink.target = "_blank";
    railLink.rel = "noopener noreferrer";
    railLink.textContent = dataSet.pdpRailId.toString();
    bindAttr(railLink, "title", () => t("dataset.railTooltip"));
    keepLinkInteractive(railLink);
    rail.append(railPrefix, railLink);
    const features = document.createElement("div");
    features.className = "dataset-features";
    const badge = document.createElement("span");
    badge.className = "piece-count";

    // Load state; the render bindings below recompute every label on a language change.
    const model = {
        endpointOrigin: null,
        features: null,
        cost: null,
        pieceCount: 0,
        totalPieceSize: 0n,
        unknownSizeCount: 0,
        partial: false,
        piecesLoaded: false,
        piecesFailed: false
    };

    const repaints = [
        bindText(title, () => t("dataset.title", { id: dataSet.dataSetId })),
        bindText(provider, () => t("dataset.storageProvider", { address: dataSet.serviceProvider })),
        bindText(railPrefix, () => t("dataset.paymentRail")),
        bindDom(endpoint, (el) => {
            el.replaceChildren();
            el.hidden = !model.endpointOrigin;
            if (!model.endpointOrigin) return;
            const link = document.createElement("a");
            link.href = `${PDP_EXPLORER_URL}/${getNetworkPath()}/providers/${dataSet.serviceProvider.toLowerCase()}`;
            link.target = "_blank";
            link.rel = "noopener noreferrer";
            link.textContent = model.endpointOrigin;
            bindAttr(link, "title", () => t("dataset.providerTooltip"));
            el.append(document.createTextNode(t("dataset.providerEndpoint")), keepLinkInteractive(link));
        }),
        bindDom(features, (el) => renderDatasetFeatures(el, model.features)),
        bindText(badge, () => badgeText(model)),
        bindAttr(badge, "title", () => badgeTooltip(model))
    ];

    identity.append(title, provider, endpoint, rail, features);
    header.append(identity, badge);
    const pieces = document.createElement("div");
    pieces.className = "pieces";
    const rowsHost = document.createElement("div");
    const moreBar = document.createElement("div");
    moreBar.className = "piece-more";
    moreBar.hidden = true;
    pieces.append(rowsHost, moreBar);
    element.append(header, pieces);
    return {
        element, badge, pieces, rowsHost, moreBar, rows: [], rendered: 0, model,
        repaint: () => repaints.forEach((apply) => apply())
    };
}

function renderDatasetFeatures(container, features) {
    container.replaceChildren();
    for (const [label, active] of [[t("dataset.ipfsIndexing"), features?.ipfsIndexing], [t("dataset.cdn"), features?.cdn]]) {
        const badge = document.createElement("span");
        badge.className = `dataset-feature ${active === undefined ? "unknown" : active ? "active" : "inactive"}`;
        badge.textContent = `${label}: ${active === undefined ? t("dataset.checking") : active ? t("dataset.active") : t("dataset.inactive")}`;
        container.appendChild(badge);
    }
}

function costLabel(cost) {
    if (!cost) return t("cost.unavailable");
    if (cost.terminated) return t("cost.storageTerminated");
    if (cost.amount === null) return t("cost.unavailable");
    return t("unit.usdfcPerMonth", { value: formatUnitsRounded(cost.amount, 18) });
}

function badgeText(model) {
    if (!model.piecesLoaded && !model.piecesFailed) return t("dataset.piecesLoading");
    if (model.piecesFailed && model.pieceCount === 0) return t("dataset.piecesUnavailable");
    const sizeLabel = model.unknownSizeCount
        ? t("dataset.sizeAtLeast", { size: formatBytes(model.totalPieceSize) })
        : formatBytes(model.totalPieceSize);
    const params = { count: model.pieceCount, size: sizeLabel, cost: costLabel(model.cost) };
    return model.partial ? t("dataset.badgePartial", params) : t("dataset.badge", params);
}

function badgeTooltip(model) {
    const note = model.unknownSizeCount === 0 ? ""
        : model.unknownSizeCount === 1 ? t("dataset.sizeUnknownNoteOne", { count: model.unknownSizeCount })
            : t("dataset.sizeUnknownNoteMany", { count: model.unknownSizeCount });
    return `${t("dataset.costTooltip")}${note}`;
}

export async function populateDataset(card, dataSet, address, pieceIndex, monthlyCostsPromise, isStale = () => false) {
    const model = card.model;
    let providerServiceUrl = null;
    let cdnEnabled = false;
    try {
        providerServiceUrl = await getProviderServiceUrl(dataSet.providerId);
        if (providerServiceUrl) {
            model.endpointOrigin = new URL(providerServiceUrl).origin;
            card.repaint();
        }
    } catch (error) {
        console.warn(`Could not resolve storage provider for dataset ${dataSet.dataSetId}.`, error);
    }
    try {
        const features = await getDatasetFeatures(dataSet.dataSetId);
        cdnEnabled = BigInt(dataSet.cdnRailId) > 0n && features.cdn;
        model.features = { ipfsIndexing: features.ipfsIndexing, cdn: cdnEnabled };
        card.repaint();
    } catch (error) {
        console.warn(`Could not read IPFS/CDN metadata for dataset ${dataSet.dataSetId}.`, error);
    }

    let cursor = 0n;
    const dirtyPieces = new Set();
    try {
        while (model.pieceCount < MAX_PIECES) {
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
                model.pieceCount++;
                if (piece.size === null) model.unknownSizeCount++;
                else model.totalPieceSize += piece.size;
            }
            if (!hasMore || pieces.length === 0) break;
            cursor = ids[ids.length - 1] + 1n;
        }
        model.piecesLoaded = true;
    } catch (error) {
        if (isStale()) return;
        model.piecesFailed = true;
        if (model.pieceCount) model.partial = true;
        card.repaint();
        addEmptyPieces(card.pieces, () => t("dataset.pieceQueryFailed", { error: errorText(error) }));
    }
    // Rows are rendered lazily in chunks; duplicate references are refreshed once per dataset.
    renderMoreRows(card, PIECE_RENDER_CHUNK);
    dirtyPieces.forEach(updatePieceDuplicateReferences);
    if (!model.piecesLoaded) return;

    try {
        const { costs } = await monthlyCostsPromise;
        model.cost = costs.get(dataSet.dataSetId) ?? null;
    } catch (error) {
        console.warn(`Could not estimate monthly cost for dataset ${dataSet.dataSetId}.`, error);
    }
    if (isStale()) return;
    card.repaint();
    if (model.pieceCount === 0) addEmptyPieces(card.pieces, () => t("dataset.emptyPieces"));
    if (model.pieceCount >= MAX_PIECES) addEmptyPieces(card.pieces, () => t("dataset.displayLimited", { count: MAX_PIECES.toLocaleString(localeTag()) }));
    await Promise.all(card.rootLoads);
}
