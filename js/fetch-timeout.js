// fetch with a timeout that also covers reading the body, plus an optional caller signal.
export function fetchWithTimeout(url, init = {}, { signal, timeoutMs, fetchImpl = fetch } = {}) {
    const controller = new AbortController();
    const abort = (reason) => controller.abort(reason);
    const timer = timeoutMs ? setTimeout(() => abort(new Error(`Request timed out after ${Math.round(timeoutMs / 1000)}s.`)), timeoutMs) : null;
    const onAbort = () => abort(signal.reason);
    if (signal) {
        if (signal.aborted) abort(signal.reason);
        else signal.addEventListener("abort", onAbort, { once: true });
    }
    const cleanup = () => {
        clearTimeout(timer);
        signal?.removeEventListener("abort", onAbort);
    };
    controller.signal.addEventListener("abort", cleanup, { once: true });
    return fetchImpl(url, { ...init, signal: controller.signal }).catch((error) => {
        cleanup();
        throw controller.signal.aborted && controller.signal.reason instanceof Error ? controller.signal.reason : error;
    });
}
