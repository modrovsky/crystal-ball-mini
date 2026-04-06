// Viem client setup — reads RPC URLs from environment variables
import { createPublicClient, webSocket, http, fallback } from 'viem';
import { mainnet } from 'viem/chains';

const RPC_URL_HTTP = process.env.RPC_URL_HTTP;
const RPC_URL_WS = process.env.RPC_URL_WS;

if (!RPC_URL_HTTP) {
  console.warn('⚠️  RPC_URL_HTTP not set — using public fallbacks (rate-limited)');
}

// HTTP client (always available, used for contract reads + block fetches)
export const publicClient = createPublicClient({
  chain: mainnet,
  transport: fallback([
    ...(RPC_URL_HTTP ? [http(RPC_URL_HTTP)] : []),
    http('https://ethereum.publicnode.com'),
    http('https://eth.llamarpc.com'),
    http('https://rpc.mevblocker.io'),
  ]),
});

// WebSocket client (optional, for real-time block subscriptions)
export function createWsClient() {
  if (!RPC_URL_WS) return null;
  try {
    return createPublicClient({
      chain: mainnet,
      transport: webSocket(RPC_URL_WS, {
        reconnect: { attempts: Infinity, delay: 3000 },
      }),
    });
  } catch (e) {
    console.warn('WebSocket failed, will use HTTP polling:', e.message);
    return null;
  }
}
