import { calibration, mainnet, DATASET_LOAD_CONCURRENCY } from "./constants.js";
import { t, errorText, onLanguageChange } from "./i18n.js";
import { initI18n, bindText } from "./i18n-ui.js";
import { mapWithConcurrency } from "./concurrency.js";
import { state, configureNetwork, getNetworkName, startSearch } from "./state.js";
import { calculateDatasetMonthlyCosts, clearProviderCache, fetchAllDataSets } from "./chain-api.js";
import { carQueue, rowRegistry } from "./pieces-ui.js";
import { populateDataset } from "./datasets-ui.js";
import { createResultsPanel, showMessage } from "./results-ui.js";
import { hideAccountOverview, loadBalances } from "./account-ui.js";
import { resolveAddressInput } from "./address-resolution.js";
import { isDirectAddressInput } from "./lookup.js";

initI18n();

const form = document.getElementById("lookupForm");
const addressInput = document.getElementById("walletAddress");
const fetchButton = document.getElementById("fetchBtn");
const networkOptions = Array.from(document.querySelectorAll('input[name="network"]'));
const results = document.getElementById("results");
form.addEventListener("submit", (event) => {
    event.preventDefault();
    loadDatasets();
});

addressInput.addEventListener("input", () => setInputError(null));

// Keeps the native validation bubble in sync with the language while an error is shown.
let inputErrorRender = null;
function setInputError(render) {
    inputErrorRender = render;
    addressInput.setCustomValidity(render ? render() : "");
}

// Button label follows the lookup state; the binding re-translates it on a language change.
let buttonState = "idle"; // "idle" | "ens" | "loading"
const repaintButton = bindText(fetchButton, () => {
    if (buttonState === "ens") return t("app.resolvingEns");
    if (buttonState === "loading") return t("app.loadingData");
    return t("form.fetchBtn");
});

// Re-applies a pending input error in the new language.
onLanguageChange(() => {
    if (inputErrorRender) addressInput.setCustomValidity(inputErrorRender());
});

function setButtonState(next) {
    buttonState = next;
    repaintButton();
}

function getSelectedChain() {
    return networkOptions.find((option) => option.checked)?.value === "calibration" ? calibration : mainnet;
}

async function loadDatasets() {
    const lookupInput = addressInput.value.trim();
    const isAddressInput = isDirectAddressInput(lookupInput);
    setInputError(null);
    const isStale = startSearch();
    carQueue.clear();
    rowRegistry.clear();
    clearProviderCache();
    hideAccountOverview();
    fetchButton.disabled = true;
    setButtonState(isAddressInput ? "loading" : "ens");
    networkOptions.forEach((option) => { option.disabled = true; });
    results.setAttribute("aria-busy", "true");
    showMessage(results, () => isAddressInput
        ? t("app.preparing")
        : t("app.resolvingName", { name: lookupInput || t("app.ensName") }));

    try {
        let address;
        try {
            address = await resolveAddressInput(lookupInput);
        } catch (error) {
            if (!isStale()) {
                setInputError(() => errorText(error));
                addressInput.reportValidity();
                showMessage(results, () => errorText(error), { isError: true });
            }
            return;
        }
        if (isStale()) return;

        setInputError(null);
        configureNetwork(getSelectedChain());
        setButtonState("loading");
        showMessage(results, () => t("app.readingDatasets", { network: getNetworkName(state.chain) }));

        const dataSets = await fetchAllDataSets(address);
        if (isStale()) return;
        if (dataSets.length === 0) {
            showMessage(results, () => t("app.noDatasets"));
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
        if (!isStale()) showMessage(results, () => t("app.requestFailed", { error: errorText(error) }), { isError: true });
    } finally {
        if (!isStale()) {
            fetchButton.disabled = false;
            setButtonState("idle");
            networkOptions.forEach((option) => { option.disabled = false; });
            results.setAttribute("aria-busy", "false");
        }
    }
}
