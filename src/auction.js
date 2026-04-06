// Auction state — reads the current Nouns auction from the on-chain contract
import { publicClient } from './client.js';

// Nouns Auction House (mainnet)
const AUCTION_HOUSE = '0x830BD73E4184ceF73443C15111a1DF14e495C706';

const AUCTION_ABI = [
  {
    name: 'auction',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [
      { name: 'nounId', type: 'uint256' },
      { name: 'amount', type: 'uint256' },
      { name: 'startTime', type: 'uint256' },
      { name: 'endTime', type: 'uint256' },
      { name: 'bidder', type: 'address' },
      { name: 'settled', type: 'bool' },
    ],
  },
];

/**
 * Fetch the current live auction from the Nouns Auction House contract.
 * Returns { nounId, amount, startTime, endTime, bidder, settled }.
 */
export async function getCurrentAuction() {
  const result = await publicClient.readContract({
    address: AUCTION_HOUSE,
    abi: AUCTION_ABI,
    functionName: 'auction',
  });

  return {
    nounId: Number(result[0]),
    amount: result[1],           // bigint (wei)
    startTime: Number(result[2]),
    endTime: Number(result[3]),
    bidder: result[4],
    settled: result[5],
  };
}
