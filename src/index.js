#!/usr/bin/env node
// Live crystal ball — watches for new blocks and continuously predicts the next noun.
//
// Outputs a new prediction every time a block arrives (~12 seconds).
// If RPC_URL_WS is set, uses WebSocket for real-time updates.
// Otherwise falls back to polling every 12 seconds.
//
// Usage:
//   node src/index.js               # pretty-print to terminal
//   node src/index.js --json        # one JSON object per line (for piping to hardware)
//   node src/index.js --svg         # also write SVG files to output/ each block
//
import 'dotenv/config';
import { writeFileSync, mkdirSync } from 'fs';
import pkg from '@noundry/nouns-assets';
const { getNounSeedFromBlockHash } = pkg;
import { publicClient, createWsClient } from './client.js';
import { getCurrentAuction } from './auction.js';
import { generateNoun, traitNames } from './svg.js';
import { formatEther } from 'viem';

const jsonMode = process.argv.includes('--json');
const svgMode = process.argv.includes('--svg');

if (svgMode) mkdirSync('output', { recursive: true });

let lastBlockHash = null;
let cachedAuction = null;
let auctionFetchedAt = 0;
const AUCTION_CACHE_MS = 30_000; // re-fetch auction every 30s

async function refreshAuction() {
  const now = Date.now();
  if (cachedAuction && now - auctionFetchedAt < AUCTION_CACHE_MS) return cachedAuction;
  try {
    cachedAuction = await getCurrentAuction();
    auctionFetchedAt = now;
  } catch (e) {
    if (!cachedAuction) throw e;
    // Use stale cache on error
  }
  return cachedAuction;
}

async function onBlock(blockNumber, blockHash) {
  if (blockHash === lastBlockHash) return;
  lastBlockHash = blockHash;

  try {
    const auction = await refreshAuction();
    const nextNounId = auction.nounId + 1;
    const seed = getNounSeedFromBlockHash(BigInt(nextNounId), blockHash);
    const secondsLeft = auction.endTime - Math.floor(Date.now() / 1000);

    const traits = {
      background: traitNames.backgrounds[seed.background] || `bg-${seed.background}`,
      body: traitNames.bodies[seed.body] || `body-${seed.body}`,
      accessory: traitNames.accessories[seed.accessory] || `accessory-${seed.accessory}`,
      head: traitNames.heads[seed.head] || `head-${seed.head}`,
      glasses: traitNames.glasses[seed.glasses] || `glasses-${seed.glasses}`,
    };

    if (jsonMode) {
      const payload = {
        timestamp: new Date().toISOString(),
        blockNumber: Number(blockNumber),
        blockHash,
        predictedNounId: nextNounId,
        seed,
        traits,
        auction: {
          nounId: auction.nounId,
          bid: formatEther(auction.amount),
          endTime: auction.endTime,
          secondsLeft: Math.max(0, secondsLeft),
          settled: auction.settled,
        },
      };
      // One JSON object per line — easy to parse from hardware serial/pipe
      console.log(JSON.stringify(payload));
    } else {
      const timeStr =
        secondsLeft > 0
          ? `${Math.floor(secondsLeft / 60)}m ${secondsLeft % 60}s`
          : 'ENDED';
      console.log(
        `[Block ${blockNumber}] Noun #${nextNounId} → ` +
          `head: ${traits.head}, glasses: ${traits.glasses}, ` +
          `body: ${traits.body}, accessory: ${traits.accessory} ` +
          `| Auction ends: ${timeStr}`
      );
    }

    if (svgMode) {
      const noun = generateNoun(seed);
      const filename = `output/noun-${nextNounId}-block-${blockNumber}.svg`;
      writeFileSync(filename, noun.svg);
    }
  } catch (e) {
    if (!jsonMode) console.error('Error processing block:', e.message);
  }
}

// --- Start watching ---

async function startPolling() {
  if (!jsonMode) console.log('Starting HTTP polling (every 12s)...');
  const poll = async () => {
    try {
      const block = await publicClient.getBlock();
      await onBlock(Number(block.number), block.hash);
    } catch (e) {
      if (!jsonMode) console.error('Poll error:', e.message);
    }
  };
  await poll();
  setInterval(poll, 12_000);
}

async function startWatching() {
  const wsClient = createWsClient();
  if (!wsClient) {
    return startPolling();
  }

  if (!jsonMode) console.log('Connected via WebSocket — watching for new blocks...');

  wsClient.watchBlocks({
    onBlock: async (block) => {
      if (!block?.hash) return;
      await onBlock(Number(block.number), block.hash);
    },
    onError: (err) => {
      if (!jsonMode) console.error('WebSocket error, falling back to polling:', err.message);
      startPolling();
    },
  });

  // Safety net: poll every 30s in case WS goes silent
  setInterval(async () => {
    try {
      const block = await publicClient.getBlock();
      await onBlock(Number(block.number), block.hash);
    } catch { /* ignore */ }
  }, 30_000);
}

if (!jsonMode) {
  console.log('');
  console.log('  NOUNS CRYSTAL BALL (live)');
  console.log('  Ctrl+C to stop');
  console.log('');
}

startWatching().catch((err) => {
  console.error('Fatal:', err.message);
  process.exit(1);
});
