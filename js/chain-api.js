import { decodeFunctionResult, encodeFunctionData } from "https://esm.sh/viem@2?bundle";
import { getRail } from "https://esm.sh/@filoz/synapse-core@0.10.0/pay?bundle";
import { PAGE_SIZE, DATASET_LOAD_CONCURRENCY, fwssAbi, pdpAbi, providerRegistryAbi } from "./constants.js";
import { hexToBytes } from "./car.js";
import { formatUnitsRounded } from "./format.js";
import { mapWithConcurrency } from "./concurrency.js";
import { createRpc } from "./rpc.js";
import { state } from "./state.js";

export const { rpcRequest, rpcCall } = createRpc({
    getUrl: () => state.rpcUrl,
    encodeFunctionData,
    decodeFunctionResult,
    getSignal: () => state.searchController.signal
});

export async function fetchAllDataSets(address) {
    const dataSets = [];
    for (let offset = 0n; offset < 50000n; offset += PAGE_SIZE) {
        const page = await rpcCall(state.fwssView, fwssAbi, "getClientDataSets", [address, offset, PAGE_SIZE]);
        dataSets.push(...page);
        if (page.length < Number(PAGE_SIZE)) return dataSets;
    }
    throw new Error("The account has more than 50,000 datasets; stopped for safety.");
}

export async function fetchPiecePage(dataSetId, cursor) {
    return rpcCall(state.pdpVerifier, pdpAbi, "getActivePiecesByCursor", [dataSetId, cursor, PAGE_SIZE]);
}

export async function getDatasetFeatures(dataSetId) {
    const [keys] = await rpcCall(state.fwssView, fwssAbi, "getAllDataSetMetadata", [dataSetId]);
    return {
        ipfsIndexing: keys.includes("withIPFSIndexing"),
        cdn: keys.includes("withCDN")
    };
}

const providerUrlCache = new Map();

export function getProviderServiceUrl(providerId) {
    const key = `${state.chain.id}:${providerId}`;
    if (!providerUrlCache.has(key)) {
        const lookup = fetchProviderServiceUrl(providerId);
        lookup.catch(() => providerUrlCache.delete(key));
        providerUrlCache.set(key, lookup);
    }
    return providerUrlCache.get(key);
}

async function fetchProviderServiceUrl(providerId) {
    const provider = await rpcCall(state.providerRegistry, providerRegistryAbi, "getProviderWithProduct", [providerId, 0]);
    if (!provider.product.isActive) return null;
    const urlIndex = provider.product.capabilityKeys.indexOf("serviceURL");
    if (urlIndex < 0 || !provider.productCapabilityValues[urlIndex]) return null;
    const serviceUrl = new TextDecoder().decode(hexToBytes(provider.productCapabilityValues[urlIndex]));
    const parsedUrl = new URL(serviceUrl);
    if (parsedUrl.protocol !== "https:" && parsedUrl.protocol !== "http:") return null;
    return serviceUrl;
}

export async function calculateDatasetMonthlyCosts(dataSets) {
    const costs = await mapWithConcurrency(dataSets, DATASET_LOAD_CONCURRENCY, async (dataSet) => {
        if (dataSet.pdpEndEpoch > 0n) return { dataSetId: dataSet.dataSetId, label: "storage terminated", amount: 0n };
        try {
            const rail = await getRail(state.readClient, { railId: dataSet.pdpRailId });
            const amount = rail.paymentRate * 86400n;
            return { dataSetId: dataSet.dataSetId, label: `${formatUnitsRounded(amount, 18)} USDFC/mo`, amount };
        } catch (error) {
            console.warn(`Could not read Filecoin Pay rate for dataset ${dataSet.dataSetId}.`, error);
            return { dataSetId: dataSet.dataSetId, label: "monthly cost unavailable", amount: null };
        }
    });
    return {
        labels: new Map(costs.map(({ dataSetId, label }) => [dataSetId, label]))
    };
}
