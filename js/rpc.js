import { fetchWithTimeout } from "./fetch-timeout.js";
import { RPC_TIMEOUT_MS, RPC_MAX_RETRIES, RPC_RETRY_BASE_DELAY_MS } from "./limits.js";

const sleepFor = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

class RetryableError extends Error {}

export function createRpc({
    getUrl,
    encodeFunctionData,
    decodeFunctionResult,
    fetchImpl = (...args) => fetch(...args),
    timeoutMs = RPC_TIMEOUT_MS,
    maxRetries = RPC_MAX_RETRIES,
    retryDelayMs = RPC_RETRY_BASE_DELAY_MS,
    sleep = sleepFor,
    getSignal = () => undefined
}) {
    async function attempt(method, params, signal) {
        let response;
        try {
            response = await fetchWithTimeout(getUrl(), {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ jsonrpc: "2.0", method, params, id: 1 })
            }, { signal, timeoutMs, fetchImpl });
        } catch (error) {
            if (signal?.aborted) throw error;
            throw new RetryableError(error.message || "RPC request failed");
        }
        if (!response.ok) {
            const message = `RPC HTTP error ${response.status}`;
            if (response.status === 429 || response.status >= 500) throw new RetryableError(message);
            throw new Error(message);
        }
        const payload = await response.json();
        if (payload.error) throw new Error(payload.error.message || "RPC call failed");
        return payload.result;
    }

    async function rpcRequest(method, params) {
        const signal = getSignal();
        for (let retry = 0; ; retry++) {
            try {
                return await attempt(method, params, signal);
            } catch (error) {
                if (!(error instanceof RetryableError) || retry >= maxRetries || signal?.aborted) throw error;
                await sleep(retryDelayMs * 3 ** retry);
            }
        }
    }

    async function rpcCall(to, abi, functionName, args) {
        const data = encodeFunctionData({ abi, functionName, args });
        const result = await rpcRequest("eth_call", [{ to, data }, "latest"]);
        if (!result || result === "0x") throw new Error("Empty response from smart contract");
        return decodeFunctionResult({ abi, functionName, data: result });
    }

    return { rpcRequest, rpcCall };
}
