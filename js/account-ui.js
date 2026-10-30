import { getAccountSummary } from "https://esm.sh/@filoz/synapse-core@0.10.0/pay?bundle";
import { t } from "./i18n.js";
import { bindText } from "./i18n-ui.js";
import { formatStorageHorizon, formatUnits, formatUnitsFixed, formatUnitsRounded } from "./format.js";
import { usdfcAbi } from "./constants.js";
import { rpcCall, rpcRequest } from "./chain-api.js";
import { state } from "./state.js";

const accountOverview = document.getElementById("accountOverview");
const fields = {
    fil: document.getElementById("filBalance"),
    usdfc: document.getElementById("usdfcBalance"),
    runway: document.getElementById("storageRunway"),
    monthlyCost: document.getElementById("totalMonthlyCost"),
    total: document.getElementById("payTotalAmount"),
    available: document.getElementById("payAvailableAmount"),
    locked: document.getElementById("payLockedAmount")
};

// Raw lookup results per field: undefined = loading, null = unavailable, otherwise data to format.
// The render bindings read this model, so a language change re-computes the formatted strings.
const view = {};

const summaryField = (render) => () => {
    if (view.summary === undefined) return t("account.loading");
    if (view.summary === null) return t("account.unavailable");
    return render(view.summary);
};

const repaints = [
    bindText(fields.fil, () => {
        if (view.fil === undefined) return t("account.loading");
        if (view.fil === null) return t("account.unavailable");
        return `${formatUnits(view.fil, 18)} FIL`;
    }),
    bindText(fields.usdfc, () => {
        if (view.usdfc === undefined) return t("account.loading");
        if (view.usdfc === null) return t("account.unavailable");
        return `${formatUnitsFixed(view.usdfc.balance, view.usdfc.decimals)} USDFC`;
    }),
    bindText(fields.runway, summaryField((summary) => formatStorageHorizon(summary.runwayInEpochs, summary.lockupRatePerEpoch, summary.debt, true))),
    bindText(fields.monthlyCost, summaryField((summary) => t("unit.usdfcPerMonth", { value: formatUnitsRounded(summary.lockupRatePerMonth, 18) }))),
    bindText(fields.total, summaryField((summary) => `${formatUnits(summary.funds, 18)} USDFC`)),
    bindText(fields.available, summaryField((summary) => `${formatUnits(summary.availableFunds, 18)} USDFC`)),
    bindText(fields.locked, summaryField((summary) => `${formatUnits(summary.totalLockup, 18)} USDFC`))
];

function repaint() {
    for (const apply of repaints) apply();
}

export function hideAccountOverview() {
    accountOverview.hidden = true;
}

export async function loadBalances(address, isCurrent = () => true) {
    accountOverview.hidden = false;
    Object.assign(view, { fil: undefined, usdfc: undefined, summary: undefined });
    repaint();

    const [filResult, usdfcResult, accountSummaryResult] = await Promise.allSettled([
        rpcRequest("eth_getBalance", [address, "latest"]).then((value) => BigInt(value)),
        Promise.all([
            rpcCall(state.usdfcToken, usdfcAbi, "balanceOf", [address]),
            rpcCall(state.usdfcToken, usdfcAbi, "decimals", [])
        ]).then(([balance, decimals]) => ({ balance: BigInt(balance), decimals: Number(decimals) })),
        getAccountSummary(state.readClient, { address })
    ]);

    if (!isCurrent()) return;

    view.fil = filResult.status === "fulfilled" ? filResult.value : null;
    view.usdfc = usdfcResult.status === "fulfilled" ? usdfcResult.value : null;
    view.summary = accountSummaryResult.status === "fulfilled" ? accountSummaryResult.value : null;
    repaint();
    if (accountSummaryResult.status === "rejected") console.warn("Storage runway could not be loaded.", accountSummaryResult.reason);
    if (filResult.status === "rejected") console.warn("FIL balance could not be loaded.", filResult.reason);
    if (usdfcResult.status === "rejected") console.warn("USDFC balance could not be loaded.", usdfcResult.reason);
}
