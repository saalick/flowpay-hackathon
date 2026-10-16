const BASE = process.env.NEXT_PUBLIC_API_BASE ?? "http://localhost:8787";

export const DEMO_MERCHANT_HANDLE = "thai-coffee-01";

async function j<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: { "content-type": "application/json", ...(init?.headers ?? {}) },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`${path} ${res.status}: ${text}`);
  }
  return res.json();
}

export type Deployment = {
  chainId: number;
  settlement: `0x${string}`;
  treasury: `0x${string}`;
  lpRegistry: `0x${string}`;
  tripFactory: `0x${string}`;
  tripImplementation: `0x${string}`;
  usdc: `0x${string}`;
  demoMerchantId: `0x${string}`;
  explorer: Record<string, string>;
};

export type Quote = {
  orderRef: `0x${string}`;
  merchantId: `0x${string}`;
  payer: `0x${string}`;
  fiatAmount: string;
  currency: `0x${string}`;
  usdcAmount: string;
  expiresAt: string;
};

export type QuoteResponse = {
  quote: Quote;
  signature: `0x${string}`;
  orderId: `0x${string}`;
  display: { fiatMajor: number; usdcMajor: number; fxUsdThb: number };
};

type RawOrder = {
  order_id: string;
  order_ref: string;
  merchant_id: string;
  payer: string;
  fiat_amount: number;
  currency: string;
  usdc_amount: string;
  status: string;
  route: string | null;
  assigned_lp: string | null;
  payment_ref: string | null;
  net_amount: string | null;
  fee: string | null;
  created_at: number;
  open_until: number | null;
  pay_deadline: number | null;
  settled_at: number | null;
  tx_create: string | null;
  tx_accept: string | null;
  tx_mark_paid: string | null;
  tx_route: string | null;
  tx_settle: string | null;
};

export type Order = {
  id: string;
  orderRef: string;
  merchantId: string;
  payer: string;
  fiatAmount: string;
  currency: string;
  usdcAmount: string;
  status: string;
  route: string | null;
  lp: string | null;
  openUntil: number | null;
  payDeadline: number | null;
  createdAt: number;
  settledAt: number | null;
  payTx: string | null;
  settleTx: string | null;
  paymentRef: string | null;
  disputeReason?: string | null;
};

function toOrder(r: RawOrder): Order {
  return {
    id: r.order_id,
    orderRef: r.order_ref,
    merchantId: r.merchant_id,
    payer: r.payer,
    fiatAmount: String(r.fiat_amount),
    currency: r.currency,
    usdcAmount: r.usdc_amount,
    status: r.status,
    route: r.route,
    lp: r.assigned_lp,
    openUntil: r.open_until,
    payDeadline: r.pay_deadline,
    createdAt: r.created_at,
    settledAt: r.settled_at,
    payTx: r.tx_create,
    settleTx: r.tx_mark_paid ?? r.tx_route ?? r.tx_settle,
    paymentRef: r.payment_ref,
    disputeReason: null,
  };
}

type RawLP = {
  address: string;
  display_name: string;
  rail: string;
  currency: string;
  online: 0 | 1;
  auto_accept: 0 | 1;
  created_at: number;
};
export type LP = {
  address: string;
  displayName: string;
  rail: string;
  currency: string;
  online: 0 | 1;
  autoAccept: 0 | 1;
  createdAt: number;
  stake?: { total: string; locked: string; free: string; registered: boolean };
};
function toLP(r: RawLP): LP {
  return {
    address: r.address,
    displayName: r.display_name,
    rail: r.rail,
    currency: r.currency,
    online: r.online,
    autoAccept: r.auto_accept,
    createdAt: r.created_at,
  };
}

export const api = {
  health: () => j<{ ok: boolean; chainId: number }>("/health"),
  deployment: () => j<Deployment>("/deployment"),
  fx: () => j<{ usdThb: number; spreadBps: number; provider: string; asOf: string }>("/fx"),

  quote: (body: { payer: string; fiatAmount: number; merchantHandle?: string }) =>
    j<QuoteResponse>("/quote", {
      method: "POST",
      body: JSON.stringify({
        payer: body.payer,
        fiatAmount: body.fiatAmount,
        currency: "THB",
        merchantHandle: body.merchantHandle ?? DEMO_MERCHANT_HANDLE,
      }),
    }),

  recordOrder: (body: {
    orderId: string;
    orderRef: string;
    merchantId: string;
    payer: string;
    fiatAmount: number;
    currency: string;
    usdcAmount: string;
    openUntil: number;
    txHash?: string;
  }) =>
    j<{ ok: true }>("/orders/record", {
      method: "POST",
      body: JSON.stringify(body),
    }),

  orders: async (q: Partial<{ payer: string; merchantId: string; status: string; limit: number }> = {}): Promise<{ orders: Order[] }> => {
    const rows = await j<RawOrder[]>(
      `/orders?${new URLSearchParams(Object.entries(q).reduce<Record<string, string>>((a, [k, v]) => {
        if (v !== undefined && v !== null) a[k] = String(v);
        return a;
      }, {})).toString()}`,
    );
    return { orders: rows.map(toOrder) };
  },
  order: async (id: string): Promise<Order> => {
    const r = await j<RawOrder>(`/orders/${id}`);
    return toOrder(r);
  },

  faucet: (to: string, amount?: string) =>
    j<{ ok: true; txHash: string; explorer: string; amount: string }>("/faucet", {
      method: "POST",
      body: JSON.stringify({ to, amount }),
    }),
  flags: () => j<{ flags: Record<string, string> }>("/admin/flags"),
  setFlag: (key: string, value: string) =>
    j<{ ok: true; flags: Record<string, string> }>("/admin/flag", {
      method: "POST",
      body: JSON.stringify({ key, value }),
    }),

  confirm: (orderId: string) =>
    j<{ ok: true; txHash: string; explorer: string }>("/merchant/confirm", {
      method: "POST",
      body: JSON.stringify({ orderId }),
    }),
  dispute: (orderId: string, reason: string) =>
    j<{ ok: true; txHash: string; explorer: string }>("/merchant/dispute", {
      method: "POST",
      body: JSON.stringify({ orderId, reason }),
    }),

  lps: async (): Promise<{ lps: LP[] }> => {
    const rows = await j<RawLP[]>("/lp/list");
    return { lps: rows.map(toLP) };
  },
  lp: async (addr: string): Promise<LP> => {
    const r = await j<RawLP & { stake?: LP["stake"] }>(`/lp/${addr}`);
    return { ...toLP(r), stake: r.stake };
  },
  announceLp: (body: {
    address: string;
    displayName: string;
    rail?: string;
    currency?: string;
    online?: boolean;
    autoAccept?: boolean;
  }) => j<{ ok: true }>("/lp/announce", { method: "POST", body: JSON.stringify(body) }),
  updateLp: (body: { address: string; online?: boolean; autoAccept?: boolean }) =>
    j<{ ok: true }>("/lp/update", { method: "POST", body: JSON.stringify(body) }),

  predictTrip: (owner: string, salt: string) =>
    j<{ account: string }>(
      `/trip/predict?owner=${encodeURIComponent(owner)}&salt=${encodeURIComponent(salt)}`,
    ),
  tripInfo: async (address: string): Promise<{ exists: boolean; owner: string | null }> => {
    try {
      const r = await j<{ owner: string }>(`/trip/${address}`);
      return { exists: true, owner: r.owner };
    } catch {
      return { exists: false, owner: null };
    }
  },
  createTrip: (body: {
    owner: string;
    tripBudget: string;
    perTxCap: string;
    expiresAt: number;
    salt: string;
  }) =>
    j<{ ok: true; account: string; txHash: string; explorer: string }>("/trip/create", {
      method: "POST",
      body: JSON.stringify(body),
    }),
};

export { BASE };
