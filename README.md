# Nouns Crystal Ball (Mini)

Predict the next Noun before it's born. This is a minimal, standalone extraction of the crystal ball prediction engine from the Nouns Game web app — designed to be hackable for physical devices, bots, dashboards, or anything else.

## How it works

Every Nouns auction mints a new NFT. The visual traits (head, glasses, body, accessory, background) are determined **deterministically** by:

1. The **noun ID** (sequential, next = current auction + 1)
2. The **block hash** of the Ethereum block at settlement time

Since blocks arrive every ~12 seconds, the prediction changes with each block. The crystal ball shows what the next noun **would look like** if the auction settled right now.

The prediction uses `getNounSeedFromBlockHash()` from `@noundry/nouns-assets` — the same deterministic algorithm the on-chain Nouns contracts use.

## Quick start

```bash
# Install dependencies
npm install

# Copy env and optionally add your own RPC URLs
cp .env.example .env

# One-shot prediction (prints to terminal + writes SVG)
npm run predict

# Live mode — new prediction every block (~12s)
npm start
```

## Scripts

### `npm run predict` — One-shot

Fetches the current block + auction, predicts the next noun, prints a summary, and writes an SVG to `output/`.

```bash
node src/predict.js           # pretty terminal output
node src/predict.js --json    # JSON to stdout (for piping)
```

### `npm start` — Live watcher

Continuously watches for new Ethereum blocks and outputs a prediction for each one.

```bash
node src/index.js             # human-readable terminal output
node src/index.js --json      # one JSON object per line (newline-delimited)
node src/index.js --svg       # also write SVG files to output/ each block
```

The `--json` mode outputs one JSON object per line, making it easy to pipe to a physical device over serial, a WebSocket server, or any other consumer:

```json
{"timestamp":"2025-01-15T12:00:00.000Z","blockNumber":19500000,"blockHash":"0xabc...","predictedNounId":1234,"seed":{"background":0,"body":14,"accessory":72,"head":119,"glasses":8},"traits":{"background":"d5d7e1","body":"body-teal","accessory":"accessory-bird-side","head":"head-shark","glasses":"glasses-square-red"},"auction":{"nounId":1233,"bid":"12.5","endTime":1705320000,"secondsLeft":180,"settled":false}}
```

## Environment variables

| Variable | Required | Description |
|---|---|---|
| `RPC_URL_HTTP` | Recommended | HTTP RPC endpoint (Alchemy, Infura, Ankr, etc.). Falls back to public RPCs if not set. |
| `RPC_URL_WS` | Optional | WebSocket RPC endpoint. Enables real-time block subscriptions instead of 12s polling. |
| `SUBGRAPH_ENDPOINT` | Optional | Nouns subgraph GraphQL endpoint (Goldsky/The Graph). Enables historical trait matching. A public mainnet endpoint is included in `.env.example`. |
| `PONDER_ENDPOINT` | Optional | Alternative to subgraph — Ponder indexer GraphQL endpoint. Uses cursor pagination instead of first/skip. |

Free RPC providers:
- [Alchemy](https://www.alchemy.com/) — free tier includes HTTP + WebSocket
- [Infura](https://www.infura.io/) — free tier includes HTTP + WebSocket
- [Ankr](https://www.ankr.com/) — generous free tier
- Public RPCs work too but are rate-limited (the app handles this gracefully)

## Project structure

```
src/
  client.js      — Viem client setup (HTTP + optional WebSocket)
  auction.js     — Reads current auction state from the Auction House contract
  svg.js         — Generates 320x320 pixel-art SVG from a noun seed
  predict.js     — One-shot prediction script
  index.js       — Live block watcher with continuous predictions
  historical.js  — Optional: fetch all past noun seeds + trait matching
```

## Core concepts

### Noun seed

A seed is 5 numbers that fully determine a noun's appearance:

```js
{
  background: 0,    // 0-1 (warm/cool)
  body: 14,         // 0-29
  accessory: 72,    // 0-136
  head: 119,        // 0-233
  glasses: 8        // 0-20
}
```

### Prediction algorithm

```js
import { getNounSeedFromBlockHash } from '@noundry/nouns-assets';

// The same algorithm the on-chain contract uses
const seed = getNounSeedFromBlockHash(BigInt(nextNounId), blockHash);
```

This is a pure function — same inputs always produce the same output. The prediction is "correct" for the current block, and changes with the next block.

### SVG generation

The SVG builder decodes RLE-encoded image data from the Nouns asset library and renders 10x10 pixel rectangles into a 320x320 SVG. This is the same rendering pipeline the Nouns website uses.

## Using with a physical device

The `--json` flag on both scripts outputs machine-readable JSON. Some ideas:

- **Serial/UART**: Pipe JSON lines to an ESP32/Arduino over serial
- **E-ink display**: Parse the SVG and render to a Waveshare/Pimoroni display
- **LED matrix**: Map the 32x32 pixel grid (320/10) to a WS2812B matrix
- **LCD**: Render the SVG to a small TFT display via a Raspberry Pi

For an LED matrix, the noun is conceptually a 32x32 grid — each `<rect>` in the SVG is 10x10 pixels, so divide coordinates by 10 to get the grid position.

## Historical trait matching

With either a subgraph or Ponder endpoint configured, you can compare predicted traits against all ~1800+ historical nouns:

```js
import 'dotenv/config';
import { fetchAllSeeds, findMatches } from './src/historical.js';

// Uses SUBGRAPH_ENDPOINT (first/skip) or PONDER_ENDPOINT (cursor) — whichever is set
const allNouns = await fetchAllSeeds();
const matches = findMatches(predictedSeed, allNouns);
// matches[5] = perfect 5/5 match (extremely rare)
// matches[4] = 4 traits match
// etc.
```

The `.env.example` ships with a public Goldsky-hosted Nouns mainnet subgraph that works out of the box — no setup needed.

## License

MIT
