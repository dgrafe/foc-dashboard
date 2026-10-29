import { getAccountSummary } from "https://esm.sh/@filoz/synapse-core@0.10.0/pay?bundle";
import { formatStorageHorizon, formatUnits, formatUnitsFixed, formatUnitsRounded } from "./format.js";
import { usdfcAbi } from "./constants.js";
import { rpcCall, rpcRequest } from "./chain-api.js";
import { state } from "./state.js";

const accountOverview = document.getElementById("accountOverview");
const filBalance = document.getElementById("filBalance");
const usdfcBalance = document.getElementById("usdfcBalance");
const storageRunway = document.getElementById("storageRunway");
const totalMonthlyCost = document.getElementById("totalMonthlyCost");
const payTotalAmount = document.getElementById("payTotalAmount");
const payAvailableAmount = document.getElementById("payAvailableAmount");
const payLockedAmount = document.getElementById("payLockedAmount");

export function hideAccountOverview() {
    accountOverview.hidden = true;
}

export async function loadBalances(address, isCurrent = () => true) {
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

    if (!isCurrent()) return;

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
