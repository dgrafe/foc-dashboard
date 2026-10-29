import { createPublicClient, http } from "https://esm.sh/viem@2?bundle";
import { mainnet as ethereumMainnet } from "https://esm.sh/viem@2/chains?bundle";
import { getEnsAddress } from "https://esm.sh/viem@2/ens?bundle";

const ensClient = createPublicClient({
    chain: ethereumMainnet,
    transport: http()
});

export function resolveEnsName(name) {
    return getEnsAddress(ensClient, { name });
}
