import { CAR_ROOT_LOAD_CONCURRENCY } from "./constants.js";
import { t, errorText } from "./i18n.js";
import { bindText, bindAttr, bindDom } from "./i18n-ui.js";
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
    if (!rootState.container) return;
    // One binding per root state; it re-renders on every state change and language change.
    if (!rootState.repaint) rootState.repaint = bindDom(rootState.container, () => renderRootContent(rootState));
    else rootState.repaint();
}

function renderRootContent(rootState) {
    const container = rootState.container;
    if (rootState.status === "roots") {
        renderCarRoots(container, rootState.roots, () => rootState.sourceRender ? rootState.sourceRender() : rootState.source);
    } else if (rootState.status === "failure") {
        setResult(container, () => rootState.messageRender ? rootState.messageRender() : rootState.message, "failure");
    } else {
        container.textContent = t("piece.readingHeader");
    }
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
    bindText(next, () => t("piece.showNext", { count: Math.min(PIECE_RENDER_CHUNK, remaining), remaining }));
    next.addEventListener("click", () => renderMoreRows(card, PIECE_RENDER_CHUNK));
    const all = document.createElement("button");
    all.type = "button";
    bindText(all, () => t("piece.showAll"));
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
    if (!occurrence.repaintDuplicates) {
        occurrence.repaintDuplicates = bindDom(occurrence.duplicateReference, (el) => renderDuplicatesInto(el, indexedPiece, occurrence));
    } else {
        occurrence.repaintDuplicates();
    }
}

function renderDuplicatesInto(container, indexedPiece, occurrence) {
    const copies = getDuplicateCopies(indexedPiece, occurrence, MAX_DUPLICATE_LINKS);
    const hiddenCount = countDuplicateCopies(indexedPiece) - copies.length;
    container.replaceChildren(document.createTextNode(copies.length + hiddenCount === 1 ? t("piece.copyInLabel") : t("piece.copiesInLabel")));
    copies.forEach((copy, index) => {
        if (index > 0) container.append(document.createTextNode("; "));
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
        container.appendChild(link);
    });
    if (hiddenCount > 0) container.append(document.createTextNode(` ${t("piece.moreCopies", { count: hiddenCount })}`));
    container.hidden = false;
}

function createFileTreeDetails(piece) {
    const details = document.createElement("details");
    details.className = "filesystem";
    const summary = document.createElement("summary");
    bindText(summary, () => t("piece.fileTreeSummary"));
    const content = document.createElement("div");
    content.className = "filesystem-content";
    details.append(summary, content);

    // Row-local wait state; the loaded tree and errors live on the shared piece.
    let rowLoading = false;
    const repaint = bindDom(content, (el) => {
        if (piece.fileTree) {
            renderUnixFsTree(el, piece.fileTree);
        } else if (piece.fileTreeError) {
            el.replaceChildren();
            const message = document.createElement("span");
            message.className = "failure";
            message.textContent = t("piece.fileTreeUnavailable", { error: piece.fileTreeError });
            el.appendChild(message);
        } else if (rowLoading) {
            el.textContent = t("piece.fileTreeLoading");
        } else {
            el.replaceChildren();
        }
    });

    details.addEventListener("toggle", () => {
        if (!details.open) {
            if (rowLoading) {
                rowLoading = false;
                releaseFileTreeWaiter(piece);
                repaint();
            }
            return;
        }
        if (piece.fileTree || rowLoading) return;
        rowLoading = true;
        if (!piece.fileTreePromise) {
            piece.fileTreeError = null;
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
        repaint();
        const promise = piece.fileTreePromise;
        promise.then((tree) => {
            piece.fileTree = tree;
        }).catch((error) => {
            if (piece.fileTreePromise === promise) {
                piece.fileTreePromise = null;
                piece.fileTreeError = errorText(error);
            }
        }).finally(() => {
            rowLoading = false;
            repaint();
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
    bindText(hint, () => t("piece.largeCar", { size: formatBytes(size) }));
    bindAttr(hint, "title", () => t("piece.largeCarTooltip", { size: formatBytes(size) }));
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
    // "PieceID" is a protocol term and stays untranslated in every locale.
        bindText(pieceTitle, () => `PieceID ${piece.id} · ${piece.size === null ? t("piece.sizeUnavailable") : formatBytes(piece.size)}`);
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
    bindText(cidLabel, () => t("piece.cidLabel"));
    const pieceCid = document.createElement("span");
    pieceCid.className = "piece-hash";
    pieceCid.textContent = piece.cid;
    const pieceCopyControl = createHashCopyControl(piece.cid, () => t("piece.copyCid"));
    cid.append(cidLabel, pieceCid, pieceCopyControl.button, pieceCopyControl.status);

    const downloads = document.createElement("div");
    downloads.className = "piece-downloads";
    if (cdnUrl) downloads.appendChild(createDownloadLink(cdnUrl, () => t("piece.downloadCdn"), () => "CDN"));
    if (providerUrl) downloads.appendChild(createDownloadLink(providerUrl, () => t("piece.downloadProvider"), () => t("piece.sourceProvider"), "download", "provider"));
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
    rootInfo.textContent = t("piece.rootPending");
    result.append(rootInfo, rootLinks);
    element.append(identity, result, createFileTreeDetails(indexedPiece));
    return { element, result: rootInfo, duplicateReference };
}

function renderCarRoots(container, roots, sourceRender) {
    container.replaceChildren();
    container.classList.add("has-roots");
    const explorerLinks = container.parentElement.querySelector(".piece-root-links");
    explorerLinks?.replaceChildren();
    const caption = document.createElement("span");
    caption.className = "piece-link-label";
    caption.textContent = t("piece.rootPrefix");
    caption.title = t("piece.rootReadFrom", { source: sourceRender() });
    container.appendChild(caption);
    roots.forEach((root, index) => {
        if (index > 0) container.append(document.createTextNode(", "));
        const rootHash = document.createElement("span");
        rootHash.className = "piece-root-hash";
        rootHash.textContent = root;
        const rootCopyControl = createHashCopyControl(root, () => t("piece.copyRoot"));
        container.append(rootHash, rootCopyControl.button, rootCopyControl.status);

        if (explorerLinks) {
            explorerLinks.appendChild(createDownloadLink(
                `https://inbrowser.link/ipfs/${root}`,
                () => t("piece.openRoot", { root }),
                () => "inbrowser",
                "external"
            ));
        }
    });
}
