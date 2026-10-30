import { t, translatedError } from "./i18n.js";

const ADDRESS_PATTERN = /^0x[\da-fA-F]{40}$/;
const FILECOIN_EVM_PATTERN = /^[ft]410/i;

// True for inputs that are looked up directly instead of being treated as ENS names.
export function isDirectAddressInput(value) {
    const trimmed = value.trim();
    return trimmed.startsWith("0x") || FILECOIN_EVM_PATTERN.test(trimmed);
}

export async function resolveLookupInput(input, resolveEnsName, resolveFilecoinAddress) {
    const value = input.trim();
    if (!value) throw translatedError(() => t("lookup.emptyInput"));
    if (value.startsWith("0x")) {
        if (!ADDRESS_PATTERN.test(value)) {
            throw translatedError(() => t("lookup.invalidAddress"));
        }
        return value;
    }
    if (FILECOIN_EVM_PATTERN.test(value)) {
        if (!resolveFilecoinAddress) throw translatedError(() => t("lookup.conversionUnavailable"));
        return resolveFilecoinAddress(value);
    }

    let address;
    try {
        address = await resolveEnsName(value);
    } catch {
        throw translatedError(() => t("lookup.resolveFailed"));
    }
    if (!address) throw translatedError(() => t("lookup.resolveFailed"));
    if (!ADDRESS_PATTERN.test(address)) {
        throw translatedError(() => t("lookup.resolveFailed"));
    }
    return address;
}
