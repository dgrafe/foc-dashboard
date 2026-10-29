const ADDRESS_PATTERN = /^0x[\da-fA-F]{40}$/;
const FILECOIN_EVM_PATTERN = /^[ft]410/i;

// True for inputs that are looked up directly instead of being treated as ENS names.
export function isDirectAddressInput(value) {
    const trimmed = value.trim();
    return trimmed.startsWith("0x") || FILECOIN_EVM_PATTERN.test(trimmed);
}

export async function resolveLookupInput(input, resolveEnsName, resolveFilecoinAddress) {
    const value = input.trim();
    if (!value) throw new Error("Enter a 0x, f410, or t410 address, or an ENS name.");
    if (value.startsWith("0x")) {
        if (!ADDRESS_PATTERN.test(value)) {
            throw new Error("Enter a valid 0x address with 40 hexadecimal characters.");
        }
        return value;
    }
    if (FILECOIN_EVM_PATTERN.test(value)) {
        if (!resolveFilecoinAddress) throw new Error("Filecoin address conversion is unavailable.");
        return resolveFilecoinAddress(value);
    }

    let address;
    try {
        address = await resolveEnsName(value);
    } catch {
        throw new Error("Could not resolve name.");
    }
    if (!address) throw new Error("Could not resolve name.");
    if (!ADDRESS_PATTERN.test(address)) {
        throw new Error("Could not resolve name.");
    }
    return address;
}
