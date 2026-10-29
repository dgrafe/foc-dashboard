import { createPublicClient, http } from "https://esm.sh/viem@2?bundle";
import { calibration, mainnet } from "./constants.js";
import { fetchWithTimeout } from "./fetch-timeout.js";
import { RPC_TIMEOUT_MS } from "./limits.js";

// Shared mutable state; consumers read fields at call time so network switches apply everywhere.
export const state = {
    chain: mainnet,
    rpcUrl: mainnet.rpcUrls.default.http[0],
    fwssView: mainnet.contracts.fwssView.address,
    pdpVerifier: mainnet.contracts.pdp.address,
    providerRegistry: mainnet.contracts.serviceProviderRegistry.address,
    usdfcToken: mainnet.contracts.usdfc.address,
    readClient: createReadClient(mainnet),
    searchId: 0,
    searchController: new AbortController()
};

// Routing viem requests through fetchWithTimeout keeps them tied to the active search,
// so library helpers such as getRail or getAccountSummary abort with a new lookup.
// viem must not retry here: a retry would read the replacement controller and outlive the search.
function createReadClient(chain) {
    return createPublicClient({
        chain,
        transport: http(chain.rpcUrls.default.http[0], {
            retryCount: 0,
            fetchFn: (url, init) => fetchWithTimeout(url, init, {
                signal: state.searchController.signal,
                timeoutMs: RPC_TIMEOUT_MS
            })
        })
    });
}

export function configureNetwork(chain) {
    state.chain = chain;
    state.rpcUrl = chain.rpcUrls.default.http[0];
    state.fwssView = chain.contracts.fwssView.address;
    state.pdpVerifier = chain.contracts.pdp.address;
    state.providerRegistry = chain.contracts.serviceProviderRegistry.address;
    state.usdfcToken = chain.contracts.usdfc.address;
    state.readClient = createReadClient(chain);
}

export function getNetworkName(chain) {
    return chain.id === calibration.id ? "Filecoin Calibration" : "Filecoin Mainnet";
}

export function getNetworkPath() {
    return state.chain.id === calibration.id ? "calibration" : "mainnet";
}

// Cancels the previous search and returns a staleness check for the new one.
export function startSearch() {
    state.searchController.abort(new Error("A newer search was started."));
    state.searchController = new AbortController();
    const currentSearch = ++state.searchId;
    return () => currentSearch !== state.searchId;
}
