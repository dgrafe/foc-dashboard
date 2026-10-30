// DOM-free queue that loads CAR roots with bounded concurrency and tracks overall load progress.
import { t, errorText } from "./i18n.js";

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
                const sourceRender = () => t("car.providerSource");
                setRootState(rootState, { status: "roots", roots, source: sourceRender(), sourceRender });
                return;
            } catch (error) {
                if (signal?.aborted) throw error;
                providerError = error;
            }
        }

        if (cdnUrl) {
            try {
                const roots = await fetchCarRoots(cdnUrl, signal);
                const sourceRender = () => providerError ? t("car.cdnSourceFallback") : "FilBeam";
                setRootState(rootState, { status: "roots", roots, source: sourceRender(), sourceRender });
                return;
            } catch (error) {
                if (signal?.aborted) throw error;
                const messageRender = providerError
                    ? () => t("car.providerThenCdn", { provider: errorText(providerError), cdn: errorText(error) })
                    : () => t("car.cdnFailure", { error: errorText(error) });
                setRootState(rootState, { status: "failure", message: messageRender(), messageRender });
                return;
            }
        }

        const messageRender = () => t("car.failureNoCdn", {
            provider: providerError ? errorText(providerError) : t("car.noPdpEndpoint"),
            cdn: t("car.cdnDisabled")
        });
        setRootState(rootState, { status: "failure", message: messageRender(), messageRender });
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
                    const messageRender = () => t("piece.rootUnavailable", { error: errorText(error) });
                    setRootState(task.rootState, { status: "failure", message: messageRender(), messageRender });
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
