# Filecoin Onchain Cloud Dashboard

A static, client-side dashboard for the [Filecoin Onchain Cloud](https://docs.filecoin.cloud/), focused on data hosted through [Filecoin Warm Storage](https://docs.filecoin.cloud/core-concepts/fwss-overview/). Look up an FEVM address or ENS name to review its datasets and Pieces, along with wallet balances, Filecoin Pay deposits, storage runway, and estimated monthly storage costs.

## Features

- Filecoin Mainnet and Calibration support
- `0x`, `f410`, and `t410` EVM addresses are supported; native `f410`/`t410` addresses are checksum-validated and converted to their equivalent `0x` address
- ENS names are resolved on Ethereum Mainnet and can be used to look up an address on either Filecoin network
- Dataset, provider, and payment rail links
- Piece CIDs and CAR root CIDs, with copy controls
- Downloads of pieces of 1 GiB or more carry a visible size warning, since each link pulls a full CAR file
- CAR root lookups run during loading, limited to four concurrent requests; a dataset card is shown only once everything (including CAR roots) is loaded, with a progress bar until then
- Optional UnixFS directory tree inspection (CARv1 tail range requests with stream-scan fallback; CARv2 headers are supported for CAR roots)
- Requests use timeouts; RPC calls retry transient failures, and starting a new search cancels outstanding loads
- Read-only public RPC calls; no wallet connection required

## Run Locally

Serve the project root with any static HTTP server, or use the bundled one:

```sh
npm install   # once, for the build and lint tooling
npm run dev   # serves the project root on http://localhost:8000/
```

Set `PORT` to change the port. Open <http://localhost:8000/>. The site uses native browser ES modules and requires no build step for development.

## Tests

Run the data-processing and formatting tests with Node.js:

```sh
npm test
```

The suite also verifies that every runtime dependency bundled from `esm.sh` is listed in `THIRD-PARTY-NOTICES.md` with a license and an upstream link, and that the pinned versions agree with `package.json`. Since the release build strips legal comments, that file is the only bundled-license record, so run the check on its own when touching dependencies:

```sh
npm run check:notices
```

## Deployment

Build a release with esbuild (requires `npm install` once):

```sh
npm run release   # runs the tests, the notices check, then the build
npm run build     # build only
```

`dist/` then contains only `index.html`, the minified and hashed bundles in `assets/` (dependencies included, no `esm.sh` at runtime), `LICENSE`, and `THIRD-PARTY-NOTICES.md`. Publish the contents of `dist/` as the site root. During development the sources still run unbundled and load dependencies from `esm.sh`; the build maps those URLs to the exact versions pinned in `package.json`, so keep both in sync when upgrading. The app makes browser requests to Filecoin RPC endpoints and storage providers, so those endpoints must allow cross-origin requests (CORS).

## Address lookup

The lookup accepts:

- Ethereum-style `0x` addresses (40 hexadecimal characters)
- Native Filecoin EVM addresses: `f410...` for Mainnet and `t410...` for Calibration
- ENS names, resolved through Ethereum Mainnet

Native `f410` and `t410` addresses are checksum-validated and converted to their equivalent `0x` address before querying. The selected Filecoin network switch determines which chain is queried.

## License

Project code is licensed under the [MIT License](LICENSE). Runtime dependencies are governed by their own licenses; see [THIRD-PARTY-NOTICES.md](THIRD-PARTY-NOTICES.md).

## Project Structure

| Path | Responsibility |
| --- | --- |
| `index.html`, `css/styles.css` | Page markup and styles |
| `js/app.js` | Entry point, lookup form, network switch, load orchestration |
| `js/results-ui.js` | Results panel: status messages, progress bar, card reveal order |
| `js/account-ui.js` | Account balances and storage runway display |
| `js/address-resolution.js` | Compose ENS and Filecoin address resolvers |
| `js/ens.js` | Ethereum Mainnet ENS client |
| `js/filecoin-address.js` | Validate and convert `f410`/`t410` addresses |
| `js/lookup.js` | Validate and dispatch lookup input |
| `js/state.js` | Shared network and search state |
| `js/chain-api.js` | RPC reads, provider lookup, monthly costs |
| `js/datasets-ui.js`, `js/pieces-ui.js` | Dataset cards, piece rows, file tree, CAR roots |
| `js/car-queue.js` | DOM-free CAR root queue and progress |
| `js/car.js` | CAR parsing and UnixFS tree inspection |
| `js/ui-widgets.js` | Copy controls, download links, small helpers |
| `js/constants.js`, `js/limits.js` | Chain configuration, ABIs, explorer URLs, safety and request limits |
| `js/format.js` | Storage and token value formatting |
| `tests/` | Data-processing, formatting, and UI-logic tests |
