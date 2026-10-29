import { CAR_ROOT_LOAD_CONCURRENCY } from "./constants.js";
import { fetchCarRoots, fetchUnixFsFileTree, renderUnixFsTree } from "./car.js";
import { formatBytes, isLargeDownload } from "./format.js";
import { countDuplicateCopies, getDuplicateCopies } from "./piece-index.js";
import { MAX_DUPLICATE_LINKS, PIECE_RENDER_CHUNK } from "./limits.js";
import { getChunkRange, renderedCountForIndex } from "./chunks.js";
import { createCarRootQueue } from "./car-queue.js";
import { state } from "./state.js";
import { createDownloadLink, createHashCopyControl, setResult } from "./ui-widgets.js";

// Maps row element id to its card and row index so rows can be rendered on demand.
export const rowRegistry = new Map();

export function paintRootState(rootState) {
    const container = rootState.container;
    if (!container) return;
    if (rootState.status === "roots") renderCarRoots(container, rootState.roots, rootState.source);
    else if (rootState.status === "failure") setResult(container, rootState.message, "failure");
    else container.textContent = "Reading CAR header …";
}

export const carQueue = createCarRootQueue({
    fetchCarRoots,
    concurrency: CAR_ROOT_LOAD_CONCURRENCY,
    paint: paintRootState
});

export function renderMoreRows(card, count) {
    const { start, end, remaining } = getChunkRange(card.rendered, card.rows.length, count);
    const fragment = document.createDocumentFragment();
    for (let index = start; index < end; index++) {
        const data = card.rows[index];
        const row = createPieceRow(data.piece, index, data.providerUrl, data.cdnUrl, data.providerServiceUrl, data.cdnEnabled, data.indexedPiece);
        row.element.id = `piece-${data.occurrence.dataSetId}-${data.piece.id}`;
        data.occurrence.duplicateReference = row.duplicateReference;
        data.rootState.container = row.result;
        paintRootState(data.rootState);
        renderDuplicateReference(data.indexedPiece, data.occurrence);
        fragment.appendChild(row.element);
    }
    card.rowsHost.appendChild(fragment);
    card.rendered = end;
    updateMoreBar(card, remaining);
}

function updateMoreBar(card, remaining) {
    card.moreBar.replaceChildren();
    card.moreBar.hidden = remaining === 0;
    if (remaining === 0) return;
    const next = document.createElement("button");
    next.type = "button";
    next.textContent = `Show next ${Math.min(PIECE_RENDER_CHUNK, remaining)} (${remaining} more)`;
    next.addEventListener("click", () => renderMoreRows(card, PIECE_RENDER_CHUNK));
    const all = document.createElement("button");
    all.type = "button";
    all.textContent = "Show all";
    all.addEventListener("click", () => renderMoreRows(card, card.rows.length));
    card.moreBar.append(next, all);
}

function ensureRowRendered(targetId) {
    const entry = rowRegistry.get(targetId);
    if (!entry) return null;
    const needed = renderedCountForIndex(entry.index, entry.card.rendered, PIECE_RENDER_CHUNK);
    if (needed > entry.card.rendered) renderMoreRows(entry.card, needed - entry.card.rendered);
    return document.getElementById(targetId);
}

export function updatePieceDuplicateReferences(indexedPiece) {
    if (indexedPiece.datasets.length < 2) return;
    for (const occurrence of indexedPiece.datasets) renderDuplicateReference(indexedPiece, occurrence);
}

function renderDuplicateReference(indexedPiece, occurrence) {
    if (indexedPiece.datasets.length < 2 || !occurrence.duplicateReference) return;
    const copies = getDuplicateCopies(indexedPiece, occurrence, MAX_DUPLICATE_LINKS);
    const hiddenCount = countDuplicateCopies(indexedPiece) - copies.length;
    occurrence.duplicateReference.replaceChildren(document.createTextNode(`${copies.length + hiddenCount === 1 ? "Copy" : "Copies"} in `));
    copies.forEach((copy, index) => {
        if (index > 0) occurrence.duplicateReference.append(document.createTextNode("; "));
        const link = document.createElement("a");
        link.href = `#${copy.targetId}`;
        link.textContent = copy.label;
        link.addEventListener("click", (event) => {
            event.preventDefault();
            const target = ensureRowRendered(copy.targetId);
            if (!target) return;
            const targetDataset = target.closest("details.dataset");
            if (targetDataset) targetDataset.open = true;
            requestAnimationFrame(() => target.scrollIntoView({ behavior: "smooth", block: "center" }));
        });
        occurrence.duplicateReference.appendChild(link);
    });
    if (hiddenCount > 0) occurrence.duplicateReference.append(document.createTextNode(` (+${hiddenCount} more)`));
    occurrence.duplicateReference.hidden = false;
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
        if (!details.open) {
            if (details.dataset.loading === "true") releaseFileTreeWaiter(piece);
            return;
        }
        if (piece.fileTree) {
            renderUnixFsTree(content, piece.fileTree);
            return;
        }
        if (details.dataset.loading === "true") return;
        details.dataset.loading = "true";
        content.textContent = "Reading CAR directory blocks …";
        if (!piece.fileTreePromise) {
            const controller = new AbortController();
            const searchSignal = state.searchController.signal;
            const stopOnSearch = () => controller.abort(searchSignal.reason);
            searchSignal.addEventListener("abort", stopOnSearch, { once: true });
            piece.fileTreeController = controller;
            piece.fileTreeWaiters = 0;
            piece.fileTreePromise = fetchUnixFsFileTree(piece, controller.signal).finally(() => {
                searchSignal.removeEventListener("abort", stopOnSearch);
            });
        }
        piece.fileTreeWaiters++;
        const promise = piece.fileTreePromise;
        promise.then((tree) => {
            piece.fileTree = tree;
            if (details.open) renderUnixFsTree(content, tree);
        }).catch((error) => {
            if (piece.fileTreePromise === promise) piece.fileTreePromise = null;
            content.replaceChildren();
            if (!details.open) return;
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

// Aborts the shared file tree load once the last interested piece row is collapsed.
function releaseFileTreeWaiter(piece) {
    piece.fileTreeWaiters = Math.max(0, (piece.fileTreeWaiters ?? 1) - 1);
    if (piece.fileTreeWaiters === 0 && !piece.fileTree) piece.fileTreeController?.abort(new Error("File tree loading cancelled."));
}

// Downloading a CAR means pulling the whole piece, so warn once it gets large.
function createDownloadSizeHint(size) {
    if (!isLargeDownload(size)) return null;
    const hint = document.createElement("span");
    hint.className = "download-size-hint";
    hint.textContent = `Large CAR · ${formatBytes(size)}`;
    hint.title = `This download is a CAR file of about ${formatBytes(size)}. Check your connection and available disk space before starting.`;
    return hint;
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
    if (downloads.childElementCount > 0) {
        const sizeHint = createDownloadSizeHint(piece.size);
        if (sizeHint) downloads.appendChild(sizeHint);
        linksLine.appendChild(downloads);
    }
    identity.append(heading, linksLine);

    const result = document.createElement("div");
    result.className = "piece-result";
    const rootInfo = document.createElement("div");
    rootInfo.className = "piece-root";
    const rootLinks = document.createElement("div");
    rootLinks.className = "piece-root-links";
    rootInfo.textContent = "CAR root pending …";
    result.append(rootInfo, rootLinks);
    element.append(identity, result, createFileTreeDetails(indexedPiece));
    return { element, result: rootInfo, duplicateReference };
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
