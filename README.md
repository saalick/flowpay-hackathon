# FlowPay

AI travel companion with crypto-in, fiat-out payments on Avalanche Fuji.

Tourists hold USDC. Merchants receive Thai baht. The settlement router falls
through three routes automatically: peer-to-peer LPs → offramp → baht float.
Smart contracts enforce spending limits, escrow payments, hold LP collateral,
and restrict exits to allowlisted destinations.

**This repo is pre-release; interfaces are under review.** The implementation
and demo site land before the hackathon deadline (Fri 2026-10-16 13:30 Bangkok).

## Monorepo layout

| package      | role                                                            |
|--------------|-----------------------------------------------------------------|
| `contracts/` | Solidity ^0.8.24, Foundry. Deploys to Fuji (chain id 43113).    |
| `server/`    | Node 20 + TS. Orchestrator, quote signer, voice/AI, relayer.    |
| `web/`       | Next.js. Tourist, merchant, LP, and admin surfaces (mobile).    |

## Toolchain

- Node 20, pnpm 9
- Foundry (forge)
- Avalanche Fuji RPC: `https://api.avax-test.network/ext/bc/C/rpc`
- Explorer: https://testnet.snowtrace.io
