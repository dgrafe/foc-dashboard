import { createPublicClient, http } from "https://esm.sh/viem@2?bundle";
import { calibration, mainnet } from "./constants.js";

// Shared mutable state; consumers read fields at call time so network switches apply everywhere.
export const state = {
    chain: mainnet,
    rpcUrl: mainnet.rpcUrls.default.http[0],
    fwssView: mainnet.contracts.fwssView.address,
    pdpVerifier: mainnet.contracts.pdp.address,
    providerRegistry: mainnet.contracts.serviceProviderRegistry.address,
    usdfcToken: mainnet.contracts.usdfc.address,
    readClient: createPublicClient({ chain: mainnet, transport: http(mainnet.rpcUrls.default.http[0]) }),
    searchId: 0,
    searchController: new AbortController()
};

export function configureNetwork(chain) {
    state.chain = chain;
    state.rpcUrl = chain.rpcUrls.default.http[0];
    state.fwssView = chain.contracts.fwssView.address;
    state.pdpVerifier = chain.contracts.pdp.address;
    state.providerRegistry = chain.contracts.serviceProviderRegistry.address;
    state.usdfcToken = chain.contracts.usdfc.address;
    state.readClient = createPublicClient({ chain, transport: http(state.rpcUrl) });
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
