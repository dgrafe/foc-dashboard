import { getAccountSummary } from "https://esm.sh/@filoz/synapse-core@0.10.0/pay?bundle";
import { calibration, mainnet, DATASET_LOAD_CONCURRENCY, usdfcAbi } from "./constants.js";
import { formatStorageHorizon, formatUnits, formatUnitsFixed, formatUnitsRounded } from "./format.js";
import { mapWithConcurrency } from "./concurrency.js";
import { state, configureNetwork, getNetworkName, startSearch } from "./state.js";
import { calculateDatasetMonthlyCosts, fetchAllDataSets, rpcCall, rpcRequest } from "./chain-api.js";
import { carQueue, rowRegistry } from "./pieces-ui.js";
import { createDatasetCard, populateDataset } from "./datasets-ui.js";

const form = document.getElementById("lookupForm");
const addressInput = document.getElementById("walletAddress");
const fetchButton = document.getElementById("fetchBtn");
const networkOptions = Array.from(document.querySelectorAll('input[name="network"]'));
const results = document.getElementById("results");
const accountOverview = document.getElementById("accountOverview");
const filBalance = document.getElementById("filBalance");
const usdfcBalance = document.getElementById("usdfcBalance");
const storageRunway = document.getElementById("storageRunway");
const totalMonthlyCost = document.getElementById("totalMonthlyCost");
const payTotalAmount = document.getElementById("payTotalAmount");
const payAvailableAmount = document.getElementById("payAvailableAmount");
const payLockedAmount = document.getElementById("payLockedAmount");

form.addEventListener("submit", (event) => {
    event.preventDefault();
    loadDatasets();
});

function getSelectedChain() {
    return networkOptions.find((option) => option.checked)?.value === "calibration" ? calibration : mainnet;
}

function showMessage(message, isError = false) {
    const box = document.createElement("p");
    box.className = isError ? "message error" : "message";
    box.textContent = message;
    results.replaceChildren(box);
}

async function loadBalances(address, isStale = () => false) {
    accountOverview.hidden = false;
    filBalance.textContent = "Loading …";
    usdfcBalance.textContent = "Loading …";
    storageRunway.textContent = "Loading …";
    totalMonthlyCost.textContent = "Loading …";
    payTotalAmount.textContent = "Loading …";
    payAvailableAmount.textContent = "Loading …";
    payLockedAmount.textContent = "Loading …";
    const [filResult, usdfcResult, accountSummaryResult] = await Promise.allSettled([
        rpcRequest("eth_getBalance", [address, "latest"]).then((value) => formatUnits(BigInt(value), 18)),
        Promise.all([
            rpcCall(state.usdfcToken, usdfcAbi, "balanceOf", [address]),
            rpcCall(state.usdfcToken, usdfcAbi, "decimals", [])
        ]).then(([balance, decimals]) => formatUnitsFixed(BigInt(balance), Number(decimals))),
        getAccountSummary(state.readClient, { address })
    ]);
    if (isStale() || addressInput.value.trim().toLowerCase() !== address.toLowerCase()) return;
    filBalance.textContent = filResult.status === "fulfilled" ? `${filResult.value} FIL` : "Unavailable";
    usdfcBalance.textContent = usdfcResult.status === "fulfilled" ? `${usdfcResult.value} USDFC` : "Unavailable";
    if (accountSummaryResult.status === "fulfilled") {
        const summary = accountSummaryResult.value;
        storageRunway.textContent = formatStorageHorizon(summary.runwayInEpochs, summary.lockupRatePerEpoch, summary.debt, true);
        totalMonthlyCost.textContent = `${formatUnitsRounded(summary.lockupRatePerMonth, 18)} USDFC/mo`;
        payTotalAmount.textContent = `${formatUnits(summary.funds, 18)} USDFC`;
        payAvailableAmount.textContent = `${formatUnits(summary.availableFunds, 18)} USDFC`;
        payLockedAmount.textContent = `${formatUnits(summary.totalLockup, 18)} USDFC`;
    } else {
        storageRunway.textContent = "Unavailable";
        totalMonthlyCost.textContent = "Unavailable";
        payTotalAmount.textContent = "Unavailable";
        payAvailableAmount.textContent = "Unavailable";
        payLockedAmount.textContent = "Unavailable";
        console.warn("Storage runway could not be loaded.", accountSummaryResult.reason);
    }
    if (filResult.status === "rejected") console.warn("FIL balance could not be loaded.", filResult.reason);
    if (usdfcResult.status === "rejected") console.warn("USDFC balance could not be loaded.", usdfcResult.reason);
}

async function loadDatasets() {
    const address = addressInput.value.trim();
    if (!/^0x[\da-fA-F]{40}$/.test(address)) {
        addressInput.setCustomValidity("Enter a valid 0x address with 40 hexadecimal characters.");
        addressInput.reportValidity();
        return;
    }
    addressInput.setCustomValidity("");
    const isStale = startSearch();
    carQueue.clear();
    rowRegistry.clear();
    configureNetwork(getSelectedChain());
    loadBalances(address, isStale);
    fetchButton.disabled = true;
    fetchButton.textContent = "Loading data …";
    networkOptions.forEach((option) => { option.disabled = true; });
    results.setAttribute("aria-busy", "true");
    showMessage(`Reading datasets from ${getNetworkName(state.chain)} and loading piece lists …`);

    try {
        const dataSets = await fetchAllDataSets(address);
        if (isStale()) return;
        if (dataSets.length === 0) {
            showMessage("No FWSS datasets were found for this address.");
            return;
        }

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
            fetchButton.textContent = "Look up address";
            networkOptions.forEach((option) => { option.disabled = false; });
            results.setAttribute("aria-busy", "false");
        }
    }
}
