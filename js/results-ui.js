// Results panel rendering: status messages, the dataset panel shell, load progress and card reveal order.
import { createDatasetCard } from "./datasets-ui.js";

export function showMessage(container, message, { isError = false } = {}) {
    const box = document.createElement("p");
    box.className = isError ? "message error" : "message";
    box.textContent = message;
    container.replaceChildren(box);
}

// Builds the panel shell and reveals cards in list order once a card (including its CAR roots) is done.
export function createResultsPanel(container, dataSets, carQueue) {
    const panel = document.createElement("div");
    panel.id = "datasetPanel";
    const summary = document.createElement("div");
    summary.className = "summary";
    const heading = document.createElement("h2");
    heading.textContent = "Stored datasets";
    const count = document.createElement("span");
    const totalLabel = `${dataSets.length} ${dataSets.length === 1 ? "Dataset" : "Datasets"}`;
    const progressBar = document.createElement("progress");
    progressBar.className = "load-progress";
    progressBar.setAttribute("aria-label", "Loading datasets and CAR roots");
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

    carQueue.setProgressListener(({ cardsDone, cardsTotal, rootsDone, rootsTotal }) => {
        if (finished) return;
        if (cardsDone === cardsTotal) {
            finished = true;
            count.textContent = totalLabel;
            progressBar.remove();
            return;
        }
        count.textContent = `${totalLabel} · loading ${cardsDone}/${cardsTotal} ready · CAR roots ${rootsDone}/${rootsTotal}`;
        progressBar.max = cardsTotal + rootsTotal;
        progressBar.value = cardsDone + rootsDone;
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