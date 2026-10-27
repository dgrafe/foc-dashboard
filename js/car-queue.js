// DOM-free queue that loads CAR roots with bounded concurrency and tracks overall load progress.
export function createCarRootQueue({ fetchCarRoots, concurrency, paint = () => {}, onProgress = () => {} }) {
    const pending = [];
    const activeControllers = new Set();
    let active = 0;
    let progressListener = onProgress;
    const progress = { cardsDone: 0, cardsTotal: 0, rootsDone: 0, rootsTotal: 0 };

    const notify = () => progressListener(progress);

    function setRootState(rootState, update) {
        Object.assign(rootState, update);
        paint(rootState);
    }

    async function readCarRoot(rootState, pieceCid, providerServiceUrl, cdnUrl, signal) {
        let providerError = null;
        if (providerServiceUrl) {
            try {
                const providerUrl = new URL(`piece/${pieceCid}`, providerServiceUrl).toString();
                const roots = await fetchCarRoots(providerUrl, signal);
                setRootState(rootState, { status: "roots", roots, source: "Storage provider" });
                return;
            } catch (error) {
                if (signal?.aborted) throw error;
                providerError = error;
            }
        }

        if (cdnUrl) {
            try {
                const roots = await fetchCarRoots(cdnUrl, signal);
                const source = providerError ? "FilBeam · provider unavailable" : "FilBeam";
                setRootState(rootState, { status: "roots", roots, source });
                return;
            } catch (error) {
                if (signal?.aborted) throw error;
                const providerMessage = providerError ? `Provider: ${providerError.message}; ` : "";
                setRootState(rootState, { status: "failure", message: `${providerMessage}CDN: ${error.message}` });
                return;
            }
        }

        setRootState(rootState, {
            status: "failure",
            message: `Storage provider: ${providerError?.message || "no PDP endpoint registered"}; CDN is not enabled.`
        });
    }

    function processQueue() {
        while (active < concurrency && pending.length > 0) {
            const task = pending.shift();
            active++;
            const controller = new AbortController();
            activeControllers.add(controller);
            Promise.resolve()
                .then(() => task.load(controller.signal))
                .catch((error) => {
                    if (controller.signal.aborted) return;
                    setRootState(task.rootState, { status: "failure", message: `CAR root unavailable: ${error.message}` });
                    console.warn("Could not load CAR root.", error);
                })
                .finally(() => {
                    activeControllers.delete(controller);
                    active--;
                    task.settle();
                    processQueue();
                });
        }
    }

    // Resolves once the root has been loaded, failed, or dropped by clear().
    function enqueue(rootState, pieceCid, providerServiceUrl, cdnUrl) {
        progress.rootsTotal++;
        notify();
        return new Promise((resolve) => {
            pending.push({
                rootState,
                load: (signal) => readCarRoot(rootState, pieceCid, providerServiceUrl, cdnUrl, signal),
                settle: resolve
            });
            processQueue();
        }).then(() => {
            progress.rootsDone++;
            notify();
        });
    }

    function clear() {
        const dropped = pending.splice(0);
        for (const controller of activeControllers) controller.abort();
        for (const task of dropped) task.settle();
    }

    function resetProgress(cardsTotal) {
        Object.assign(progress, { cardsDone: 0, cardsTotal, rootsDone: 0, rootsTotal: 0 });
        notify();
    }

    function cardDone() {
        progress.cardsDone++;
        notify();
    }

    function setProgressListener(listener) {
        progressListener = listener;
    }

    return { enqueue, clear, resetProgress, cardDone, setProgressListener, progress };
}
