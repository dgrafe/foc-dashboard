// Results panel rendering: status messages, the dataset panel shell, load progress and card reveal order.
import { t } from "./i18n.js";
import { bindText, bindAttr } from "./i18n-ui.js";
import { createDatasetCard } from "./datasets-ui.js";

export function showMessage(container, render, { isError = false } = {}) {
    const box = document.createElement("p");
    box.className = isError ? "message error" : "message";
    bindText(box, render);
    container.replaceChildren(box);
}

// Builds the panel shell and reveals cards in list order once a card (including its CAR roots) is done.
export function createResultsPanel(container, dataSets, carQueue) {
    const panel = document.createElement("div");
    panel.id = "datasetPanel";
    const summary = document.createElement("div");
    summary.className = "summary";
    const heading = document.createElement("h2");
    bindText(heading, () => t("results.storedDatasets"));
    const count = document.createElement("span");
    const totalLabel = () => (dataSets.length === 1
        ? t("results.datasetsOne", { count: dataSets.length })
        : t("results.datasetsMany", { count: dataSets.length }));
    const progressBar = document.createElement("progress");
    progressBar.className = "load-progress";
    bindAttr(progressBar, "aria-label", () => t("results.progressLabel"));
    summary.append(heading, count);
    panel.append(summary, progressBar);
    container.replaceChildren(panel);

    // Cards are built detached and appended in list order, so the page never reflows out of order.
    const cards = dataSets.map((dataSet) => ({ ...createDatasetCard(dataSet), done: false, rootLoads: [] }));
    let revealedCount = 0;
    let finished = false;

    const revealReadyCards = () => {
        while (revealedCount < cards.length && cards[revealedCount].done) {
            panel.appendChild(cards[revealedCount].element);
            revealedCount++;
        }
    };

    const repaintCount = bindText(count, () => {
        if (finished) return totalLabel();
        const { cardsDone, cardsTotal, rootsDone, rootsTotal } = carQueue.progress;
        return t("results.progress", { label: totalLabel(), ready: cardsDone, total: cardsTotal, rootsDone, rootsTotal });
    });

    carQueue.setProgressListener((progress) => {
        if (finished) return;
        if (progress.cardsDone === progress.cardsTotal) finished = true;
        repaintCount();
        if (finished) {
            progressBar.remove();
            return;
        }
        progressBar.max = progress.cardsTotal + progress.rootsTotal;
        progressBar.value = progress.cardsDone + progress.rootsDone;
    });
    carQueue.resetProgress(cards.length);

    return {
        cards,
        // Marks a card complete and reveals every card that is now ready, in order.
        cardDone(index) {
            cards[index].done = true;
            carQueue.cardDone();
            revealReadyCards();
        }
    };
}