"use client";
import { http, createConfig } from "wagmi";
import { avalancheFuji } from "wagmi/chains";
import { injected } from "wagmi/connectors";

export const config = createConfig({
  chains: [avalancheFuji],
  transports: {
    [avalancheFuji.id]: http(process.env.NEXT_PUBLIC_RPC_URL),
  },
  connectors: [injected({ shimDisconnect: true })],
  ssr: true,
});

export const CHAIN_ID = Number(process.env.NEXT_PUBLIC_CHAIN_ID ?? 43113);
export const EXPLORER = process.env.NEXT_PUBLIC_EXPLORER ?? "https://testnet.snowtrace.io";
export const explorerTx = (h: string) => `${EXPLORER}/tx/${h}`;
export const explorerAddr = (a: string) => `${EXPLORER}/address/${a}`;
