export const tripAccountAbi = [
  {
    type: "function",
    name: "pay",
    stateMutability: "nonpayable",
    inputs: [
      {
        name: "q",
        type: "tuple",
        components: [
          { name: "orderRef", type: "bytes32" },
          { name: "merchantId", type: "bytes32" },
          { name: "payer", type: "address" },
          { name: "fiatAmount", type: "uint256" },
          { name: "currency", type: "bytes3" },
          { name: "usdcAmount", type: "uint256" },
          { name: "expiresAt", type: "uint64" },
        ],
      },
      { name: "quoteSig", type: "bytes" },
    ],
    outputs: [{ name: "orderId", type: "bytes32" }],
  },
  {
    type: "function",
    name: "owner",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "address" }],
  },
] as const;

export const tripFactoryAbi = [
  {
    type: "function",
    name: "predict",
    stateMutability: "view",
    inputs: [
      { name: "owner_", type: "address" },
      { name: "salt", type: "bytes32" },
    ],
    outputs: [{ name: "", type: "address" }],
  },
  {
    type: "function",
    name: "create",
    stateMutability: "nonpayable",
    inputs: [
      { name: "owner_", type: "address" },
      { name: "salt", type: "bytes32" },
    ],
    outputs: [{ name: "", type: "address" }],
  },
] as const;

export const erc20Abi = [
  {
    type: "function",
    name: "balanceOf",
    stateMutability: "view",
    inputs: [{ name: "owner", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "transfer",
    stateMutability: "nonpayable",
    inputs: [
      { name: "to", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
  {
    type: "function",
    name: "decimals",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint8" }],
  },
] as const;
