#!/usr/bin/env node
// One-shot prediction — fetches current block + auction, predicts next noun, writes SVG
//
// Usage:
//   node src/predict.js              # predict and write SVG to output/
//   node src/predict.js --json       # output prediction as JSON to stdout
//
import 'dotenv/config';
import { writeFileSync, mkdirSync } from 'fs';
import pkg from '@noundry/nouns-assets';
const { getNounSeedFromBlockHash } = pkg;
import { publicClient } from './client.js';
import { getCurrentAuction } from './auction.js';
import { generateNoun, traitNames } from './svg.js';
import { formatEther } from 'viem';

async function main() {
  const jsonMode = process.argv.includes('--json');

  // 1. Fetch current block hash
  const block = await publicClient.getBlock();
  const blockHash = block.hash;
  const blockNumber = Number(block.number);

  // 2. Fetch current auction
  const auction = await getCurrentAuction();
  const nextNounId = auction.nounId + 1;
  const secondsLeft = auction.endTime - Math.floor(Date.now() / 1000);

  // 3. Derive next noun seed deterministically from block hash
  const seed = getNounSeedFromBlockHash(BigInt(nextNounId), blockHash);
  const noun = generateNoun(seed);

  // 4. Resolve trait names
  const traits = {
    background: traitNames.backgrounds[seed.background] || `#${seed.background}`,
    body: traitNames.bodies[seed.body] || `body-${seed.body}`,
    accessory: traitNames.accessories[seed.accessory] || `accessory-${seed.accessory}`,
    head: traitNames.heads[seed.head] || `head-${seed.head}`,
    glasses: traitNames.glasses[seed.glasses] || `glasses-${seed.glasses}`,
  };

  const prediction = {
    predictedNounId: nextNounId,
    blockNumber,
    blockHash,
    seed,
    traits,
    currentAuction: {
      nounId: auction.nounId,
      currentBid: formatEther(auction.amount) + ' ETH',
      endTime: new Date(auction.endTime * 1000).toISOString(),
      secondsLeft: Math.max(0, secondsLeft),
      settled: auction.settled,
    },
  };

  if (jsonMode) {
    console.log(JSON.stringify(prediction, null, 2));
    return;
  }

  // Print summary
  console.log('');
  console.log('========================================');
  console.log('  NOUNS CRYSTAL BALL');
  console.log('========================================');
  console.log('');
  console.log(`  Block:        #${blockNumber}`);
  console.log(`  Block Hash:   ${blockHash.slice(0, 18)}...`);
  console.log('');
  console.log(`  Current Auction: Noun ${auction.nounId}`);
  console.log(`  Current Bid:     ${formatEther(auction.amount)} ETH`);
  if (secondsLeft > 0) {
    const m = Math.floor(secondsLeft / 60);
    const s = secondsLeft % 60;
    console.log(`  Ends in:         ${m}m ${s}s`);
  } else {
    console.log(`  Status:          ENDED (awaiting settlement)`);
  }
  console.log('');
  console.log('  ---- PREDICTION ----');
  console.log(`  Next Noun:    #${nextNounId}`);
  console.log(`  Background:   ${traits.background}`);
  console.log(`  Body:         ${traits.body}`);
  console.log(`  Accessory:    ${traits.accessory}`);
  console.log(`  Head:         ${traits.head}`);
  console.log(`  Glasses:      ${traits.glasses}`);
  console.log('');

  // Write SVG file
  mkdirSync('output', { recursive: true });
  const filename = `output/noun-${nextNounId}-prediction.svg`;
  writeFileSync(filename, noun.svg);
  console.log(`  SVG written to: ${filename}`);
  console.log('');
  console.log('  Note: This prediction changes every ~12 seconds');
  console.log('  with each new Ethereum block.');
  console.log('========================================');
  console.log('');
}

main().catch((err) => {
  console.error('Error:', err.message);
  process.exit(1);
});
