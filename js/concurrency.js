export async function mapWithConcurrency(items, concurrency, mapper) {
    if (!Number.isInteger(concurrency) || concurrency < 1) {
        throw new RangeError("Concurrency must be a positive integer.");
    }

    const results = new Array(items.length);
    let nextIndex = 0;
    const workerCount = Math.min(concurrency, items.length);
    const workers = Array.from({ length: workerCount }, async () => {
        while (nextIndex < items.length) {
            const index = nextIndex++;
            results[index] = await mapper(items[index], index);
        }
    });

    await Promise.all(workers);
    return results;
}
