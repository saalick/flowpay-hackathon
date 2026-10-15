# @flowpay/contracts

Solidity contracts for FlowPay. Deploys to Avalanche Fuji (chain id 43113).

## Setup

```sh
# Install Foundry if you don't have it: https://book.getfoundry.sh/
cd contracts
forge install OpenZeppelin/openzeppelin-contracts --no-commit
forge install foundry-rs/forge-std --no-commit
forge build
forge test -vv
```

## Contracts

| contract              | role                                                           |
|-----------------------|----------------------------------------------------------------|
| `TripAccount`         | Per-trip smart account. Enforces spending limits + agent cap.  |
| `TripAccountFactory`  | Deploys `TripAccount` as EIP-1167 clones (CREATE2).            |
| `FlowSettlement`      | Escrow + 3-route settlement (P2P → Offramp → Float).           |
| `LPRegistry`          | LP stake + rail metadata. Settlement locks/slashes on behalf.  |
| `TreasuryVault`       | Holds float-routed USDC. Admin withdrawal (multisig in prod).  |

Interface files in `src/interfaces/` are the authoritative shape — reviewed
before full implementation. Implementations land in `src/` alongside tests
in `test/`.
