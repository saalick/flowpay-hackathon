// Payout adapters only (simulated offramp + baht float).
// No voice/vision/chat. All responses carry provider metadata so the UI tags
// "simulated".
import { getFlag, setFlag, db } from "./db.js";

export type PayoutQuote = {
  provider: string;
  available: boolean;
  feeBps: number;
  etaSec: number;
  note?: string;
};
export type PayoutResult = {
  ok: boolean;
  payoutRef: string;
  provider: string;
  note?: string;
};

export interface PayoutAdapter {
  name: string;
  getQuote(currency: string, fiatMinor: number): Promise<PayoutQuote>;
  execute(order: { orderId: string; currency: string; fiatMinor: number }): Promise<PayoutResult>;
}

export const simulatedOfframp: PayoutAdapter = {
  name: "simulated-offramp",
  async getQuote() {
    const enabled = getFlag("offramp.enabled") === "true";
    const feeBps = Number(getFlag("offramp.feeBps") ?? "100");
    const etaSec = Number(getFlag("offramp.etaSec") ?? "30");
    return {
      provider: "simulated-offramp",
      available: enabled,
      feeBps,
      etaSec,
      note: "Simulated offramp — demo only. Prod = real business-payout API.",
    };
  },
  async execute({ orderId }) {
    return {
      ok: true,
      provider: "simulated-offramp",
      payoutRef: `SIM-${orderId.slice(2, 10)}-${Date.now()}`,
      note: "Simulated success — in prod this would be a provider-generated transfer id.",
    };
  },
};

export const floatAdapter: PayoutAdapter = {
  name: "float",
  async getQuote(currency, fiatMinor) {
    const enabled = getFlag("float.enabled") === "true";
    const balance = Number(getFlag("float.balancePHP") ?? "0");
    const fiatMajor = fiatMinor / 100;
    return {
      provider: "float",
      available: enabled && currency === "PHP" && balance >= fiatMajor,
      feeBps: 0,
      etaSec: 2,
      note: "FlowPay peso float — simulated bank account for demo.",
    };
  },
  async execute({ orderId, currency, fiatMinor }) {
    const balance = Number(getFlag("float.balancePHP") ?? "0");
    const fiatMajor = fiatMinor / 100;
    if (balance < fiatMajor) {
      return { ok: false, provider: "float", payoutRef: "", note: "Float insufficient" };
    }
    setFlag("float.balancePHP", String(balance - fiatMajor));
    const ref = `FLOAT-${Date.now()}`;
    db.prepare(
      "INSERT INTO float_ledger(order_id, currency, amount, payment_ref, created_at) VALUES(?,?,?,?,?)",
    ).run(orderId, currency, fiatMinor, ref, Date.now());
    return { ok: true, provider: "float", payoutRef: ref };
  },
};
