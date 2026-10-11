import { calibration, mainnet } from "https://esm.sh/@filoz/synapse-core@0.10.0/chains?bundle";
export { calibration, mainnet };

export const PAGE_SIZE = 100n;
export const DATASET_LOAD_CONCURRENCY = 2;
export const MAX_UINT256 = (1n << 256n) - 1n;
export const MAX_TREE_SCAN_BYTES = 1024 * 1024 * 1024;
export const MAX_TREE_NODES = 10000;
export const CAR_HEADER_RANGE_BYTES = 16384;
export const CAR_TAIL_INITIAL_RANGE_BYTES = 16 * 1024;
export const CAR_TAIL_RANGE_BYTES = 4 * 1024 * 1024;

export const dataSetComponents = [
            { name: "pdpRailId", type: "uint256" },
            { name: "cacheMissRailId", type: "uint256" },
            { name: "cdnRailId", type: "uint256" },
            { name: "payer", type: "address" },
            { name: "payee", type: "address" },
            { name: "serviceProvider", type: "address" },
            { name: "commissionBps", type: "uint256" },
            { name: "clientDataSetId", type: "uint256" },
            { name: "pdpEndEpoch", type: "uint256" },
            { name: "providerId", type: "uint256" },
            { name: "pendingOneTimePayments", type: "uint96" },
            { name: "lifecycleReserveBalance", type: "uint96" },
            { name: "dataSetId", type: "uint256" }
        ];

export const fwssAbi = [
            {
                type: "function", name: "getClientDataSets", stateMutability: "view",
                inputs: [
                    { name: "client", type: "address" },
                    { name: "offset", type: "uint256" },
                    { name: "limit", type: "uint256" }
                ],
                outputs: [{ name: "infos", type: "tuple[]", components: dataSetComponents }]
            },
            {
                type: "function", name: "getCurrentPricingRates", stateMutability: "view",
                inputs: [],
                outputs: [
                    { name: "storagePrice", type: "uint256" },
                    { name: "datasetFee", type: "uint256" }
                ]
            },
            {
                type: "function", name: "getAllDataSetMetadata", stateMutability: "view",
                inputs: [{ name: "dataSetId", type: "uint256" }],
                outputs: [
                    { name: "keys", type: "string[]" },
                    { name: "values", type: "string[]" }
                ]
            }
        ];

export const pdpAbi = [
            {
                type: "function", name: "getActivePiecesByCursor", stateMutability: "view",
                inputs: [
                    { name: "setId", type: "uint256" },
                    { name: "startPieceId", type: "uint256" },
                    { name: "limit", type: "uint256" }
                ],
                outputs: [
                    { name: "pieces", type: "tuple[]", components: [{ name: "data", type: "bytes" }] },
                    { name: "pieceIds", type: "uint256[]" },
                    { name: "hasMore", type: "bool" }
                ]
            },
            {
                type: "function", name: "getDataSetLeafCount", stateMutability: "view",
                inputs: [{ name: "setId", type: "uint256" }],
                outputs: [{ name: "", type: "uint256" }]
            }
        ];

export const usdfcAbi = [
            {
                type: "function", name: "balanceOf", stateMutability: "view",
                inputs: [{ name: "account", type: "address" }],
                outputs: [{ name: "balance", type: "uint256" }]
            },
            {
                type: "function", name: "decimals", stateMutability: "view",
                inputs: [],
                outputs: [{ name: "", type: "uint8" }]
            }
        ];

export const providerRegistryAbi = [{
            type: "function", name: "getProviderWithProduct", stateMutability: "view",
            inputs: [
                { name: "providerId", type: "uint256" },
                { name: "productType", type: "uint8" }
            ],
            outputs: [{
                name: "result", type: "tuple", components: [
                    { name: "providerId", type: "uint256" },
                    {
                        name: "providerInfo", type: "tuple", components: [
                            { name: "serviceProvider", type: "address" },
                            { name: "payee", type: "address" },
                            { name: "name", type: "string" },
                            { name: "description", type: "string" },
                            { name: "isActive", type: "bool" }
                        ]
                    },
                    {
                        name: "product", type: "tuple", components: [
                            { name: "productType", type: "uint8" },
                            { name: "capabilityKeys", type: "string[]" },
                            { name: "isActive", type: "bool" }
                        ]
                    },
                    { name: "productCapabilityValues", type: "bytes[]" }
                ]
            }]
        }];
