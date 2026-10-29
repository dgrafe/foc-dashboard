import { calibration, mainnet, DATASET_LOAD_CONCURRENCY } from "./constants.js";
import { mapWithConcurrency } from "./concurrency.js";
import { state, configureNetwork, getNetworkName, startSearch } from "./state.js";
import { calculateDatasetMonthlyCosts, fetchAllDataSets } from "./chain-api.js";
import { carQueue, rowRegistry } from "./pieces-ui.js";
import { createDatasetCard, populateDataset } from "./datasets-ui.js";
import { hideAccountOverview, loadBalances } from "./account-ui.js";
import { resolveAddressInput } from "./address-resolution.js";

const form = document.getElementById("lookupForm");
const addressInput = document.getElementById("walletAddress");
const fetchButton = document.getElementById("fetchBtn");
const networkOptions = Array.from(document.querySelectorAll('input[name="network"]'));
const results = document.getElementById("results");
form.addEventListener("submit", (event) => {
    event.preventDefault();
    loadDatasets();
});

addressInput.addEventListener("input", () => addressInput.setCustomValidity(""));

function getSelectedChain() {
    return networkOptions.find((option) => option.checked)?.value === "calibration" ? calibration : mainnet;
}

function showMessage(message, isError = false) {
    const box = document.createElement("p");
    box.className = isError ? "message error" : "message";
    box.textContent = message;
    results.replaceChildren(box);
}

async function loadDatasets() {
    const lookupInput = addressInput.value.trim();
    addressInput.setCustomValidity("");
    const isStale = startSearch();
    carQueue.clear();
    rowRegistry.clear();
    hideAccountOverview();
    fetchButton.disabled = true;
    fetchButton.textContent = lookupInput.startsWith("0x") || /^[ft]410/i.test(lookupInput) ? "Loading data …" : "Resolving ENS …";
    networkOptions.forEach((option) => { option.disabled = true; });
    results.setAttribute("aria-busy", "true");
    showMessage(lookupInput.startsWith("0x") || /^[ft]410/i.test(lookupInput)
        ? "Preparing address lookup …"
        : `Resolving ${lookupInput || "ENS name"} on Ethereum Mainnet …`);

    try {
        let address;
        try {
            address = await resolveAddressInput(lookupInput);
        } catch (error) {
            if (!isStale()) {
                addressInput.setCustomValidity(error.message);
                addressInput.reportValidity();
                showMessage(error.message, true);
            }
            return;
        }
        if (isStale()) return;

        addressInput.setCustomValidity("");
        configureNetwork(getSelectedChain());
        fetchButton.textContent = "Loading data …";
        showMessage(`Reading datasets from ${getNetworkName(state.chain)} and loading piece lists …`);

        const dataSets = await fetchAllDataSets(address);
        if (isStale()) return;
        if (dataSets.length === 0) {
            showMessage("No FWSS datasets were found for this address.");
            return;
        }
        loadBalances(address, () =>
            !isStale() && addressInput.value.trim().toLowerCase() === lookupInput.toLowerCase()
        );

        const datasetPanel = document.createElement("div");
        datasetPanel.id = "datasetPanel";
        const summary = document.createElement("div");
        summary.className = "summary";
        const heading = document.createElement("h2");
        heading.textContent = "Stored datasets";
        const count = document.createElement("span");
        const totalLabel = `${dataSets.length} ${dataSets.length === 1 ? "Dataset" : "Datasets"}`;
        const progressBar = document.createElement("progress");
        progressBar.className = "load-progress";
        summary.append(heading, count);
        datasetPanel.append(summary, progressBar);
        results.replaceChildren(datasetPanel);

        // Cards are built detached and revealed in list order once fully loaded, including CAR roots.
        const cards = dataSets.map((dataSet) => ({ ...createDatasetCard(dataSet), done: false, rootLoads: [] }));
        let revealedCount = 0;
        carQueue.setProgressListener(({ cardsDone, cardsTotal, rootsDone, rootsTotal }) => {
            if (cardsDone === cardsTotal) {
                count.textContent = totalLabel;
                progressBar.remove();
                return;
            }
            count.textContent = `${totalLabel} · loading ${cardsDone}/${cardsTotal} ready · CAR roots ${rootsDone}/${rootsTotal}`;
            progressBar.max = cardsTotal + rootsTotal;
            progressBar.value = cardsDone + rootsDone;
        });
        const revealReadyCards = () => {
            while (revealedCount < cards.length && cards[revealedCount].done) {
                datasetPanel.appendChild(cards[revealedCount].element);
                revealedCount++;
            }
        };
        carQueue.resetProgress(cards.length);

        const pieceIndex = new Map();
        const monthlyCostsPromise = calculateDatasetMonthlyCosts(dataSets);
        await mapWithConcurrency(dataSets, DATASET_LOAD_CONCURRENCY, async (dataSet, index) => {
            try {
                await populateDataset(cards[index], dataSet, address, pieceIndex, monthlyCostsPromise, isStale);
            } finally {
                if (!isStale()) {
                    cards[index].done = true;
                    carQueue.cardDone();
                    revealReadyCards();
                }
            }
        });
    } catch (error) {
        if (!isStale()) showMessage(`Request failed: ${error.message}. Check the RPC connection or whether the provider allows browser requests (CORS).`, true);
    } finally {
        if (!isStale()) {
            fetchButton.disabled = false;
            fetchButton.textContent = "Look up address or ENS";
            networkOptions.forEach((option) => { option.disabled = false; });
            results.setAttribute("aria-busy", "false");
        }
    }
}
