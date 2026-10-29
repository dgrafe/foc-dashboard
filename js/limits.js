export const CAR_ROOT_LOAD_CONCURRENCY = 4;
export const MAX_UINT256 = (1n << 256n) - 1n;
export const MAX_TREE_SCAN_BYTES = 1024 * 1024 * 1024;
export const MAX_TREE_NODES = 10000;
export const CAR_HEADER_RANGE_BYTES = 16384;
export const CAR_TAIL_INITIAL_RANGE_BYTES = 16 * 1024;
export const CAR_TAIL_RANGE_BYTES = 4 * 1024 * 1024;
export const CAR_RANGE_TIMEOUT_MS = 20000;
export const CAR_STREAM_TIMEOUT_MS = 5 * 60 * 1000;
export const RPC_TIMEOUT_MS = 15000;
export const RPC_MAX_RETRIES = 2;
export const RPC_RETRY_BASE_DELAY_MS = 300;
export const MAX_DUPLICATE_LINKS = 5;
export const PIECE_RENDER_CHUNK = 100;

// Paging and safety limits for on-chain list reads.
export const MAX_DATASETS = 50000n;
export const MAX_PIECES = 50000;

// Filecoin epochs: 30 second slots, so 2880 epochs per day and 120 per hour.
export const EPOCH_SECONDS = 30;
export const SECONDS_PER_DAY = 86400n;
export const EPOCHS_PER_DAY = 2880n;
export const EPOCHS_PER_HOUR = 120n;

// Storage provider service URL cache.
export const PROVIDER_URL_CACHE_TTL_MS = 5 * 60 * 1000;
export const PROVIDER_URL_CACHE_MAX_ENTRIES = 500;

// Pieces at or above this size get an explicit "large download" hint next to the download links.
export const LARGE_DOWNLOAD_BYTES = 1024n * 1024n * 1024n;
