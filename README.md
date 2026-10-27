# Filecoin Onchain Cloud Dashboard

A static, client-side dashboard for the [Filecoin Onchain Cloud](https://docs.filecoin.cloud/), focused on data hosted through [Filecoin Warm Storage](https://docs.filecoin.cloud/core-concepts/fwss-overview/). Look up an FEVM address to review its datasets and Pieces, along with wallet balances, Filecoin Pay deposits, storage runway, and estimated monthly storage costs.

## Features

- Filecoin Mainnet and Calibration support
- Dataset, provider, and payment rail links
- Piece CIDs and CAR root CIDs, with copy controls
- CAR root lookups run during loading, limited to four concurrent requests; a dataset card is shown only once everything (including CAR roots) is loaded, with a progress bar until then
- Optional UnixFS directory tree inspection (CARv1 tail range requests with stream-scan fallback; CARv2 headers are supported for CAR roots)
- Requests use timeouts; RPC calls retry transient failures, and starting a new search cancels outstanding loads
- Read-only public RPC calls; no wallet connection required

## Run Locally

Serve the project root with any static HTTP server. For example, with Python 3:

```sh
python -m http.server 8000
```

Open <http://localhost:8000/>. The site uses native browser ES modules and requires no build step for development.

## Tests

Run the data-processing and formatting tests with Node.js:

```sh
npm test
```

## Deployment

Build a release with esbuild (requires `npm install` once):

```sh
npm run release   # runs the tests, then the build
npm run build     # build only
```

`dist/` then contains only `index.html`, the minified and hashed bundles in `assets/` (dependencies included, no `esm.sh` at runtime), `LICENSE`, and `THIRD-PARTY-NOTICES.md`. Publish the contents of `dist/` as the site root. During development the sources still run unbundled and load dependencies from `esm.sh`; the build maps those URLs to the exact versions pinned in `package.json`, so keep both in sync when upgrading. The app makes browser requests to Filecoin RPC endpoints and storage providers, so those endpoints must allow cross-origin requests (CORS).

## License

Project code is licensed under the [MIT License](LICENSE). Runtime dependencies are governed by their own licenses; see [THIRD-PARTY-NOTICES.md](THIRD-PARTY-NOTICES.md).

## Project Structure

```text
index.html       Page markup
css/styles.css   Styles
js/app.js        Entry point: form, balances, dataset loading flow
js/state.js      Shared network and search state
js/chain-api.js  RPC reads, provider lookup, monthly costs
js/car-queue.js  DOM-free CAR root queue with progress
js/datasets-ui.js  Dataset cards and piece loading
js/pieces-ui.js  Piece rows, lazy rendering, file tree, CAR roots
js/ui-widgets.js Copy button, download links, small helpers
js/car.js        CAR parsing and UnixFS tree inspection
js/constants.js  Chain configurations, limits, and contract ABIs
js/format.js     Storage and token value formatting
js/limits.js     Shared safety and request limits
tests/           Data-processing and formatting tests
```
