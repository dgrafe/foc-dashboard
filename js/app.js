import { calibration, mainnet, DATASET_LOAD_CONCURRENCY } from "./constants.js";
import { mapWithConcurrency } from "./concurrency.js";
import { state, configureNetwork, getNetworkName, startSearch } from "./state.js";
import { calculateDatasetMonthlyCosts, clearProviderCache, fetchAllDataSets } from "./chain-api.js";
import { carQueue, rowRegistry } from "./pieces-ui.js";
import { populateDataset } from "./datasets-ui.js";
import { createResultsPanel, showMessage } from "./results-ui.js";
import { hideAccountOverview, loadBalances } from "./account-ui.js";
import { resolveAddressInput } from "./address-resolution.js";
import { isDirectAddressInput } from "./lookup.js";

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

async function loadDatasets() {
    const lookupInput = addressInput.value.trim();
    const isAddressInput = isDirectAddressInput(lookupInput);
    addressInput.setCustomValidity("");
    const isStale = startSearch();
    carQueue.clear();
    rowRegistry.clear();
    clearProviderCache();
    hideAccountOverview();
    fetchButton.disabled = true;
    fetchButton.textContent = isAddressInput ? "Loading data …" : "Resolving ENS …";
    networkOptions.forEach((option) => { option.disabled = true; });
    results.setAttribute("aria-busy", "true");
    showMessage(results, isAddressInput
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
                showMessage(results, error.message, { isError: true });
            }
            return;
        }
        if (isStale()) return;

        addressInput.setCustomValidity("");
        configureNetwork(getSelectedChain());
        fetchButton.textContent = "Loading data …";
        showMessage(results, `Reading datasets from ${getNetworkName(state.chain)} and loading piece lists …`);

        const dataSets = await fetchAllDataSets(address);
        if (isStale()) return;
        if (dataSets.length === 0) {
            showMessage(results, "No FWSS datasets were found for this address.");
            return;
        }
        loadBalances(address, () =>
            !isStale() && addressInput.value.trim().toLowerCase() === lookupInput.toLowerCase()
        );

        const panel = createResultsPanel(results, dataSets, carQueue);
        const pieceIndex = new Map();
        const monthlyCostsPromise = calculateDatasetMonthlyCosts(dataSets);
        await mapWithConcurrency(dataSets, DATASET_LOAD_CONCURRENCY, async (dataSet, index) => {
            try {
                await populateDataset(panel.cards[index], dataSet, address, pieceIndex, monthlyCostsPromise, isStale);
            } finally {
                if (!isStale()) panel.cardDone(index);
            }
        });
    } catch (error) {
        if (!isStale()) showMessage(results, `Request failed: ${error.message}. Check the RPC connection or whether the provider allows browser requests (CORS).`, { isError: true });
    } finally {
        if (!isStale()) {
            fetchButton.disabled = false;
            fetchButton.textContent = "Look up address or ENS";
            networkOptions.forEach((option) => { option.disabled = false; });
            results.setAttribute("aria-busy", "false");
        }
    }
}
