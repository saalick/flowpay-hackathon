import { keccak256, stringToBytes, encodeAbiParameters, type Address, type Hex } from "viem";
import { serverAccount } from "./chain.js";

export type Quote = {
  orderRef: Hex;
  merchantId: Hex;
  payer: Address;
  fiatAmount: bigint;
  currency: Hex;
  usdcAmount: bigint;
  expiresAt: bigint;
};

const QUOTE_TYPES = {
  Quote: [
    { name: "orderRef", type: "bytes32" },
    { name: "merchantId", type: "bytes32" },
    { name: "payer", type: "address" },
    { name: "fiatAmount", type: "uint256" },
    { name: "currency", type: "bytes3" },
    { name: "usdcAmount", type: "uint256" },
    { name: "expiresAt", type: "uint64" },
  ],
} as const;

export async function signQuoteForSettlement(q: Quote, settlement: Address, chainId: number): Promise<Hex> {
  return serverAccount.signTypedData({
    domain: {
      name: "FlowPay-Settlement",
      version: "1",
      chainId,
      verifyingContract: settlement,
    },
    types: QUOTE_TYPES,
    primaryType: "Quote",
    message: q,
  });
}

export function thbCurrencyBytes3(): Hex {
  return `0x${Buffer.from("THB", "ascii").toString("hex")}` as Hex;
}

export function newOrderRef(): Hex {
  const buf = new Uint8Array(32);
  crypto.getRandomValues(buf);
  return `0x${Buffer.from(buf).toString("hex")}` as Hex;
}

export function merchantIdFromHandle(handle: string): Hex {
  return keccak256(stringToBytes(handle));
}

export function deriveOrderId(orderRef: Hex, chainId: number, settlement: Address): Hex {
  return keccak256(
    encodeAbiParameters(
      [{ type: "bytes32" }, { type: "uint256" }, { type: "address" }],
      [orderRef, BigInt(chainId), settlement],
    ),
  );
}
