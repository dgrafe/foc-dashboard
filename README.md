# Filecoin Onchain Cloud Dashboard

A static, client-side dashboard for the [Filecoin Onchain Cloud](https://docs.filecoin.cloud/), focused on data hosted through [Filecoin Warm Storage](https://docs.filecoin.cloud/core-concepts/fwss-overview/). Look up an FEVM address to review its datasets and Pieces, along with wallet balances, Filecoin Pay deposits, storage runway, and estimated monthly storage costs.

## Features

- Filecoin Mainnet and Calibration support
- Dataset, provider, and payment rail links
- Piece CIDs and CAR root CIDs, with copy controls
- Optional UnixFS directory tree inspection
- Read-only public RPC calls; no wallet connection required

## Run Locally

Serve the project root with any static HTTP server. For example, with Python 3:

```sh
python -m http.server 8000
```

Open <http://localhost:8000/>. The site uses native browser ES modules and requires no build step.

## Deployment

Publish the project root as the site root, keeping `index.html`, `css/`, and `js/` together. The app makes browser requests to Filecoin RPC endpoints and storage providers, so those endpoints must allow cross-origin requests (CORS).

## License

Project code is licensed under the [MIT License](LICENSE). Runtime dependencies are governed by their own licenses; see [THIRD-PARTY-NOTICES.md](THIRD-PARTY-NOTICES.md).

## Project Structure

```text
index.html       Page markup
css/styles.css   Styles
js/app.js        Dashboard behavior
js/constants.js  Chain configurations and contract ABIs
```
