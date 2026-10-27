export function addPieceToIndex(index, piece, dataSetId, providerServiceUrl, cdnUrl) {
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

export function getDuplicateCopies(indexedPiece, occurrence, limit = Infinity) {
    const copies = [];
    for (const candidate of indexedPiece.datasets) {
        if (candidate === occurrence) continue;
        if (copies.length >= limit) break;
        copies.push({
            label: `Dataset ${candidate.dataSetId} · PieceID ${candidate.pieceId}`,
            targetId: `piece-${candidate.dataSetId}-${candidate.pieceId}`
        });
    }
    return copies;
}

export function countDuplicateCopies(indexedPiece) {
    return indexedPiece.datasets.length - 1;
}
