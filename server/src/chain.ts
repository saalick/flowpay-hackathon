import { createPublicClient, createWalletClient, http, defineChain, type Chain } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { env } from "./env.js";

export const fuji: Chain = defineChain({
  id: 84532,
  name: "Base Sepolia",
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: { default: { http: [env.FUJI_RPC_URL] } },
  blockExplorers: { default: { name: "BaseScan", url: "https://sepolia.basescan.org" } },
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

// Base Sepolia has proper EIP-1559 and reliable gas estimation, so no proxy
// hacks needed. viem builds type-2 txs by default; just set a conservative
// gas limit so single-tx funds cover the burn.
export const walletClient = new Proxy(_baseWalletClient, {
  get(target, prop, receiver) {
    if (prop === "writeContract") {
      return (args: Parameters<typeof target.writeContract>[0]) =>
        target.writeContract({
          gas: 500_000n,
          ...args,
        } as Parameters<typeof target.writeContract>[0]);
    }
    return Reflect.get(target, prop, receiver);
  },
}) as typeof _baseWalletClient;

export function explorerTx(hash: `0x${string}`) { return `https://sepolia.basescan.org/tx/${hash}`; }
export function explorerAddr(addr: `0x${string}`) { return `https://sepolia.basescan.org/address/${addr}`; }
