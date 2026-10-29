import { base32 } from "https://esm.sh/multiformats@13/bases/base32?bundle";
import { blake2b } from "https://esm.sh/@noble/hashes@1.8.0/blake2b?bundle";
import { resolveEnsName } from "./ens.js";
import { filecoinAddressToEthAddress } from "./filecoin-address.js";
import { resolveLookupInput } from "./lookup.js";

export function resolveAddressInput(input) {
    return resolveLookupInput(
        input,
        resolveEnsName,
        (value) => filecoinAddressToEthAddress(value, base32, blake2b)
    );
}
