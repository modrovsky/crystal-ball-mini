// Historical trait matching — fetches all past noun seeds and finds matches
// Supports two backends:
//   1. Nouns Subgraph (The Graph / Goldsky) — uses first/skip pagination, seed nested under noun
//   2. Ponder indexer — uses cursor pagination, seeds as a top-level entity
//
// Set SUBGRAPH_ENDPOINT or PONDER_ENDPOINT in .env (subgraph is checked first).
import { publicClient } from './client.js';

const SUBGRAPH_ENDPOINT = process.env.SUBGRAPH_ENDPOINT;
const PONDER_ENDPOINT = process.env.PONDER_ENDPOINT;

// Nouns Token contract (mainnet)
const NOUNS_TOKEN = '0x9C8fF314C9Bc7F6e59A9d9225Fb22946427eDC03';
const SEEDS_ABI = [
  {
    name: 'seeds',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: '', type: 'uint256' }],
    outputs: [
      { name: 'background', type: 'uint48' },
      { name: 'body', type: 'uint48' },
      { name: 'accessory', type: 'uint48' },
      { name: 'head', type: 'uint48' },
      { name: 'glasses', type: 'uint48' },
    ],
  },
];

/**
 * Fetch a single noun's seed directly from the on-chain contract.
 */
export async function fetchSeedOnChain(nounId) {
  const result = await publicClient.readContract({
    address: NOUNS_TOKEN,
    abi: SEEDS_ABI,
    functionName: 'seeds',
    args: [BigInt(nounId)],
  });
  return {
    background: Number(result[0]),
    body: Number(result[1]),
    accessory: Number(result[2]),
    head: Number(result[3]),
    glasses: Number(result[4]),
  };
}

// ── Subgraph backend (first/skip pagination) ──────────────────────────

async function fetchAllSeedsFromSubgraph() {
  const allItems = [];
  const PAGE_SIZE = 1000;
  let skip = 0;
  let hasMore = true;

  while (hasMore) {
    const query = `{
      nouns(first: ${PAGE_SIZE}, skip: ${skip}, orderBy: id, orderDirection: asc) {
        id
        seed {
          background
          body
          accessory
          head
          glasses
        }
      }
    }`;

    const res = await fetch(SUBGRAPH_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query }),
    });

    if (!res.ok) throw new Error(`Subgraph query failed: ${res.status}`);
    const json = await res.json();
    if (json.errors) throw new Error(JSON.stringify(json.errors));

    const nouns = json.data?.nouns ?? [];
    for (const noun of nouns) {
      if (noun.seed) {
        allItems.push({
          id: String(noun.id),
          background: Number(noun.seed.background),
          body: Number(noun.seed.body),
          accessory: Number(noun.seed.accessory),
          head: Number(noun.seed.head),
          glasses: Number(noun.seed.glasses),
        });
      }
    }

    hasMore = nouns.length === PAGE_SIZE;
    skip += PAGE_SIZE;
  }

  // Subgraph sorts IDs as strings ("999" after "998"), so re-sort numerically
  allItems.sort((a, b) => Number(a.id) - Number(b.id));
  return allItems;
}

// ── Ponder backend (cursor pagination) ────────────────────────────────

async function fetchAllSeedsFromPonder() {
  const allItems = [];
  let cursor = null;
  let hasMore = true;

  while (hasMore) {
    const afterClause = cursor ? `, after: "${cursor}"` : '';
    const query = `{
      seeds(limit: 1000, orderBy: "id", orderDirection: "asc"${afterClause}) {
        pageInfo { hasNextPage endCursor }
        items { id background body accessory head glasses }
      }
    }`;

    const res = await fetch(PONDER_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query }),
    });

    if (!res.ok) throw new Error(`Ponder query failed: ${res.status}`);
    const json = await res.json();
    if (json.errors) throw new Error(JSON.stringify(json.errors));

    const result = json.data.seeds;
    if (result?.items) {
      for (const s of result.items) {
        allItems.push({
          id: String(s.id),
          background: Number(s.background),
          body: Number(s.body),
          accessory: Number(s.accessory),
          head: Number(s.head),
          glasses: Number(s.glasses),
        });
      }
    }
    hasMore = result?.pageInfo?.hasNextPage ?? false;
    cursor = result?.pageInfo?.endCursor ?? null;
  }

  return allItems;
}

// ── Public API ────────────────────────────────────────────────────────

/**
 * Fetch all historical noun seeds.
 * Tries SUBGRAPH_ENDPOINT first, then PONDER_ENDPOINT.
 * Returns null if neither is configured.
 */
export async function fetchAllSeeds() {
  if (SUBGRAPH_ENDPOINT) return fetchAllSeedsFromSubgraph();
  if (PONDER_ENDPOINT) return fetchAllSeedsFromPonder();
  return null;
}

/**
 * Count how many traits match between a predicted seed and a historical noun.
 * Returns 0–5 (background, body, accessory, head, glasses).
 */
export function countTraitMatches(predicted, historical) {
  let matches = 0;
  if (predicted.background === historical.background) matches++;
  if (predicted.body === historical.body) matches++;
  if (predicted.accessory === historical.accessory) matches++;
  if (predicted.head === historical.head) matches++;
  if (predicted.glasses === historical.glasses) matches++;
  return matches;
}

/**
 * Find historical nouns grouped by match count (1–5).
 * @param {object} seed - Predicted seed
 * @param {Array} allNouns - All historical nouns
 * @returns {{ 1: Array, 2: Array, 3: Array, 4: Array, 5: Array }}
 */
export function findMatches(seed, allNouns) {
  const groups = { 1: [], 2: [], 3: [], 4: [], 5: [] };
  for (const noun of allNouns) {
    const count = countTraitMatches(seed, noun);
    if (count > 0) groups[count].push(noun);
  }
  return groups;
}
