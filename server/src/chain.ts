import { createPublicClient, createWalletClient, http, defineChain, type Chain } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { env } from "./env.js";

export const fuji: Chain = defineChain({
  id: 43113,
  name: "Avalanche Fuji",
  nativeCurrency: { name: "AVAX", symbol: "AVAX", decimals: 18 },
  rpcUrls: { default: { http: [env.FUJI_RPC_URL] } },
  blockExplorers: { default: { name: "Snowtrace", url: "https://testnet.snowtrace.io" } },
  testnet: true,
});

export const serverAccount = privateKeyToAccount(env.SERVER_PRIVATE_KEY as `0x${string}`);

export const publicClient = createPublicClient({
  chain: fuji,
  transport: http(env.FUJI_RPC_URL),
});

const _baseWalletClient = createWalletClient({
  account: serverAccount,
  chain: fuji,
  transport: http(env.FUJI_RPC_URL),
});

// Fuji providers (publicnode in particular) reject EIP-1559 txs and refuse to
// serve `pending`-block state for gas estimation. Force legacy mode with
// explicit gas on every writeContract so it works on any provider.
export const walletClient = new Proxy(_baseWalletClient, {
  get(target, prop, receiver) {
    if (prop === "writeContract") {
      return (args: Parameters<typeof target.writeContract>[0]) =>
        target.writeContract({
          type: "legacy",
          gas: 180_000n,
          gasPrice: 25_000_000_000n,
          ...args,
        } as Parameters<typeof target.writeContract>[0]);
    }
    return Reflect.get(target, prop, receiver);
  },
}) as typeof _baseWalletClient;

export function explorerTx(hash: `0x${string}`) { return `https://testnet.snowtrace.io/tx/${hash}`; }
export function explorerAddr(addr: `0x${string}`) { return `https://testnet.snowtrace.io/address/${addr}`; }
