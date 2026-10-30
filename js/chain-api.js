import { decodeFunctionResult, encodeFunctionData } from "https://esm.sh/viem@2?bundle";
import { getRail } from "https://esm.sh/@filoz/synapse-core@0.10.0/pay?bundle";
import { t, localeTag } from "./i18n.js";
import { PAGE_SIZE, DATASET_LOAD_CONCURRENCY, fwssAbi, pdpAbi, providerRegistryAbi } from "./constants.js";
import { MAX_DATASETS, SECONDS_PER_DAY, PROVIDER_URL_CACHE_TTL_MS, PROVIDER_URL_CACHE_MAX_ENTRIES } from "./limits.js";
import { hexToBytes } from "./car.js";
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
    for (let offset = 0n; offset < MAX_DATASETS; offset += PAGE_SIZE) {
        const page = await rpcCall(state.fwssView, fwssAbi, "getClientDataSets", [address, offset, PAGE_SIZE]);
        dataSets.push(...page);
        if (page.length < Number(PAGE_SIZE)) return dataSets;
    }
    throw new Error(t("chain.tooManyDatasets", { count: MAX_DATASETS.toLocaleString(localeTag()) }));
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

export function clearProviderCache() {
    providerUrlCache.clear();
}

export function getProviderServiceUrl(providerId) {
    const key = `${state.chain.id}:${providerId}`;
    const cached = providerUrlCache.get(key);
    if (cached && Date.now() - cached.createdAt < PROVIDER_URL_CACHE_TTL_MS) return cached.promise;
    if (cached) providerUrlCache.delete(key);

    const lookup = fetchProviderServiceUrl(providerId);
    lookup.catch(() => providerUrlCache.delete(key));
    providerUrlCache.set(key, { createdAt: Date.now(), promise: lookup });

    // Keep the cache bounded; Map iteration order is insertion order, so the first key is the oldest.
    while (providerUrlCache.size > PROVIDER_URL_CACHE_MAX_ENTRIES) {
        providerUrlCache.delete(providerUrlCache.keys().next().value);
    }
    return lookup;
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
        if (dataSet.pdpEndEpoch > 0n) return { dataSetId: dataSet.dataSetId, terminated: true, amount: 0n };
        try {
            const rail = await getRail(state.readClient, { railId: dataSet.pdpRailId });
            return { dataSetId: dataSet.dataSetId, terminated: false, amount: rail.paymentRate * SECONDS_PER_DAY };
        } catch (error) {
            console.warn(`Could not read Filecoin Pay rate for dataset ${dataSet.dataSetId}.`, error);
            return { dataSetId: dataSet.dataSetId, terminated: false, amount: null };
        }
    });
    return {
        costs: new Map(costs.map(({ dataSetId, terminated, amount }) => [dataSetId, { terminated, amount }]))
    };
}
