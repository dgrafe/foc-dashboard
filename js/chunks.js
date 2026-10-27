export function getChunkRange(renderedCount, totalCount, chunkSize) {
    const end = Math.min(totalCount, renderedCount + chunkSize);
    return { start: renderedCount, end, remaining: totalCount - end };
}

// Number of rows that must be rendered so that the row at `index` is included.
export function renderedCountForIndex(index, renderedCount, chunkSize) {
    if (index < renderedCount) return renderedCount;
    return (Math.floor(index / chunkSize) + 1) * chunkSize;
}
