export function filecoinAddressToEthAddress(value, base32, blake2b) {
    const match = /^([ft])410f([a-z2-7]+)$/i.exec(value.trim());
    if (!match) throw new Error("Enter a valid f410 or t410 Filecoin address.");

    try {
        const addressBytes = base32.decode(`b${match[2].toLowerCase()}`);
        if (addressBytes.length !== 24) throw new Error("Invalid address length.");

        const subaddress = addressBytes.subarray(0, 20);
        const checksum = addressBytes.subarray(20);
        const expectedChecksum = blake2b(Uint8Array.from([4, 10, ...subaddress]), { dkLen: 4 });
        if (!expectedChecksum.every((byte, index) => byte === checksum[index])) {
            throw new Error("Invalid address checksum.");
        }

        return `0x${Array.from(subaddress, (byte) => byte.toString(16).padStart(2, "0")).join("")}`;
    } catch {
        throw new Error("Enter a valid f410 or t410 Filecoin address.");
    }
}
