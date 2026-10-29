// fetch with a timeout that also covers reading the body, plus an optional caller signal.
const hasNativeSignals = typeof AbortSignal.any === "function" && typeof AbortSignal.timeout === "function";

const timeoutMessage = (timeoutMs) => `Request timed out after ${Math.round(timeoutMs / 1000)}s.`;

export function fetchWithTimeout(url, init = {}, { signal, timeoutMs, fetchImpl = fetch } = {}) {
    if (hasNativeSignals) {
        const signals = [signal, timeoutMs ? AbortSignal.timeout(timeoutMs) : null].filter(Boolean);
        if (signals.length === 0) return fetchImpl(url, init);
        // Composite signals need no manual timer or listener bookkeeping, so nothing outlives the request.
        const composite = AbortSignal.any(signals);
        return fetchImpl(url, { ...init, signal: composite }).catch((error) => {
            if (!composite.aborted) throw error;
            if (composite.reason?.name === "TimeoutError") throw new Error(timeoutMessage(timeoutMs));
            throw composite.reason ?? error;
        });
    }
    return fetchWithTemporaryController(url, init, { signal, timeoutMs, fetchImpl });
}

// Legacy path for browsers without AbortSignal.any; mirrors the native behaviour closely enough.
function fetchWithTemporaryController(url, init, { signal, timeoutMs, fetchImpl }) {
    const controller = new AbortController();
    const timer = timeoutMs ? setTimeout(() => controller.abort(new Error(timeoutMessage(timeoutMs))), timeoutMs) : null;
    const onAbort = () => controller.abort(signal.reason);
    if (signal) {
        if (signal.aborted) onAbort();
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
