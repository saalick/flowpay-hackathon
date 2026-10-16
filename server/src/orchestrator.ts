import { publicClient, walletClient, serverAccount, explorerTx } from "./chain.js";
import { settlementAbi } from "./abis.js";
import { requireDeployment } from "./deployments.js";
import { db, getFlag } from "./db.js";
import { env } from "./env.js";
import { publish } from "./events.js";
import { simulatedOfframp, floatAdapter } from "./adapters.js";
import { keccak256, stringToBytes, type Hex } from "viem";

const dep = requireDeployment();
const SIM_OFFRAMP_ID = keccak256(stringToBytes("sim-offramp-01"));

type OrderRow = {
  order_id: string; order_ref: string; merchant_id: string; payer: string;
  fiat_amount: number; currency: string; usdc_amount: string;
  status: string; route: string | null; assigned_lp: string | null;
  payment_ref: string | null; net_amount: string | null; fee: string | null;
  created_at: number; open_until: number; pay_deadline: number | null;
  settled_at: number | null;
  tx_create: string | null; tx_accept: string | null; tx_mark_paid: string | null;
  tx_route: string | null; tx_settle: string | null;
  updated_at: number;
};

export function recordOrder(row: Omit<OrderRow, "updated_at">) {
  db.prepare(
    `INSERT INTO orders(order_id, order_ref, merchant_id, payer, fiat_amount, currency, usdc_amount,
      status, route, assigned_lp, payment_ref, net_amount, fee,
      created_at, open_until, pay_deadline, settled_at,
      tx_create, tx_accept, tx_mark_paid, tx_route, tx_settle, updated_at)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
     ON CONFLICT(order_id) DO UPDATE SET
       status=excluded.status, route=excluded.route, open_until=excluded.open_until, updated_at=excluded.updated_at`,
  ).run(
    row.order_id, row.order_ref, row.merchant_id, row.payer, row.fiat_amount, row.currency, row.usdc_amount,
    row.status, row.route, row.assigned_lp, row.payment_ref, row.net_amount, row.fee,
    row.created_at, row.open_until, row.pay_deadline, row.settled_at,
    row.tx_create, row.tx_accept, row.tx_mark_paid, row.tx_route, row.tx_settle, Date.now(),
  );
}

function updateOrder(orderId: string, patch: Partial<OrderRow>) {
  const keys = Object.keys(patch).filter((k) => k !== "order_id");
  if (keys.length === 0) return;
  const sets = keys.map((k) => `${k}=?`).join(", ");
  const values = keys.map((k) => (patch as Record<string, unknown>)[k]);
  db.prepare(`UPDATE orders SET ${sets}, updated_at=? WHERE order_id=?`).run(
    ...values, Date.now(), orderId,
  );
}

export function listOrders(filter?: { payer?: string; merchant_id?: string; status?: string; limit?: number }) {
  const where: string[] = [];
  const params: unknown[] = [];
  if (filter?.payer) { where.push("payer = ?"); params.push(filter.payer); }
  if (filter?.merchant_id) { where.push("merchant_id = ?"); params.push(filter.merchant_id); }
  if (filter?.status) { where.push("status = ?"); params.push(filter.status); }
  const sql = `SELECT * FROM orders ${where.length ? "WHERE " + where.join(" AND ") : ""} ORDER BY created_at DESC LIMIT ?`;
  params.push(filter?.limit ?? 100);
  return db.prepare(sql).all(...params) as OrderRow[];
}

export function getOrder(orderId: string): OrderRow | undefined {
  return db.prepare("SELECT * FROM orders WHERE order_id = ?").get(orderId) as OrderRow | undefined;
}

async function doOfframp(orderId: Hex, row: OrderRow) {
  const txHash = await walletClient.writeContract({
    account: serverAccount, chain: walletClient.chain,
    address: dep.settlement, abi: settlementAbi,
    functionName: "routeToOfframp",
    args: [orderId, SIM_OFFRAMP_ID],
  });
  updateOrder(orderId, { status: "routed_offramp", route: "offramp", tx_route: txHash });
  publish("order.routed", { orderId, route: "offramp", txHash, explorer: explorerTx(txHash) });
  const payout = await simulatedOfframp.execute({ orderId, currency: row.currency, fiatMinor: row.fiat_amount });
  updateOrder(orderId, { payment_ref: payout.payoutRef, settled_at: Date.now() });
  publish("order.settled", { orderId, route: "offramp", payoutRef: payout.payoutRef });
}

async function doFloat(orderId: Hex, row: OrderRow) {
  const txHash = await walletClient.writeContract({
    account: serverAccount, chain: walletClient.chain,
    address: dep.settlement, abi: settlementAbi,
    functionName: "routeToFloat",
    args: [orderId],
  });
  updateOrder(orderId, { status: "routed_float", route: "float", tx_route: txHash });
  publish("order.routed", { orderId, route: "float", txHash, explorer: explorerTx(txHash) });
  const payout = await floatAdapter.execute({ orderId, currency: row.currency, fiatMinor: row.fiat_amount });
  updateOrder(orderId, { payment_ref: payout.payoutRef, settled_at: Date.now() });
  publish("order.settled", { orderId, route: "float", payoutRef: payout.payoutRef });
}

async function doRefund(orderId: Hex) {
  const txHash = await walletClient.writeContract({
    account: serverAccount, chain: walletClient.chain,
    address: dep.settlement, abi: settlementAbi,
    functionName: "refund",
    args: [orderId],
  });
  updateOrder(orderId, { status: "refunded", tx_route: txHash });
  publish("order.refunded", { orderId, txHash, explorer: explorerTx(txHash) });
}

async function tryRoute(orderId: Hex) {
  const row = getOrder(orderId);
  if (!row || row.status !== "open") return;
  const now = Math.floor(Date.now() / 1000);
  if (now <= row.open_until) return;

  const currency = row.currency;
  const fiatMinor = row.fiat_amount;
  const maxFee = Number(getFlag("maxOfframpFeeBps") ?? env.MAX_OFFRAMP_FEE_BPS);
  const maxEta = Number(getFlag("maxOfframpEtaSec") ?? env.MAX_OFFRAMP_ETA_SEC);

  // Operator override — pin a specific route for the demo.
  const forced = (getFlag("FORCE_ROUTE") ?? "").trim();
  try {
    if (forced === "offramp") return await doOfframp(orderId, row);
    if (forced === "float")   return await doFloat(orderId, row);
    if (forced === "refund")  return await doRefund(orderId);
    if (forced === "p2p") {
      updateOrder(orderId, { open_until: now + 20 });
      return;
    }
  } catch (err) {
    console.error("[orchestrator] forced route failed:", err);
    return;
  }

  const [offQuote, floatQuote] = await Promise.all([
    simulatedOfframp.getQuote(currency, fiatMinor),
    floatAdapter.getQuote(currency, fiatMinor),
  ]);

  const offrampOk = offQuote.available && offQuote.feeBps <= maxFee && offQuote.etaSec <= maxEta;

  try {
    if (offrampOk) {
      const txHash = await walletClient.writeContract({
        account: serverAccount, chain: walletClient.chain,
        address: dep.settlement, abi: settlementAbi,
        functionName: "routeToOfframp",
        args: [orderId, SIM_OFFRAMP_ID],
      });
      updateOrder(orderId, { status: "routed_offramp", route: "offramp", tx_route: txHash });
      publish("order.routed", { orderId, route: "offramp", txHash, explorer: explorerTx(txHash) });
      const payout = await simulatedOfframp.execute({ orderId, currency, fiatMinor });
      updateOrder(orderId, { payment_ref: payout.payoutRef, settled_at: Date.now() });
      publish("order.settled", { orderId, route: "offramp", payoutRef: payout.payoutRef });
      return;
    }
    if (floatQuote.available) {
      const txHash = await walletClient.writeContract({
        account: serverAccount, chain: walletClient.chain,
        address: dep.settlement, abi: settlementAbi,
        functionName: "routeToFloat",
        args: [orderId],
      });
      updateOrder(orderId, { status: "routed_float", route: "float", tx_route: txHash });
      publish("order.routed", { orderId, route: "float", txHash, explorer: explorerTx(txHash) });
      const payout = await floatAdapter.execute({ orderId, currency, fiatMinor });
      updateOrder(orderId, { payment_ref: payout.payoutRef, settled_at: Date.now() });
      publish("order.settled", { orderId, route: "float", payoutRef: payout.payoutRef });
      return;
    }
    // all routes exhausted — refund tourist
    const txHash = await walletClient.writeContract({
      account: serverAccount, chain: walletClient.chain,
      address: dep.settlement, abi: settlementAbi,
      functionName: "refund",
      args: [orderId],
    });
    updateOrder(orderId, { status: "refunded", tx_route: txHash });
    publish("order.refunded", { orderId, txHash, explorer: explorerTx(txHash) });
  } catch (err) {
    console.error("[orchestrator] route failed:", err);
  }
}

async function handleLPAcceptedTimeout(orderId: Hex) {
  const row = getOrder(orderId);
  if (!row || row.status !== "accepted") return;
  const now = Math.floor(Date.now() / 1000);
  if (!row.pay_deadline || now <= row.pay_deadline) return;
  try {
    const txHash = await walletClient.writeContract({
      account: serverAccount, chain: walletClient.chain,
      address: dep.settlement, abi: settlementAbi,
      functionName: "routeToFloat",
      args: [orderId],
    });
    updateOrder(orderId, { status: "routed_float", route: "float", tx_route: txHash });
    publish("order.routed", { orderId, route: "float-after-slash", txHash, explorer: explorerTx(txHash) });
    const payout = await floatAdapter.execute({ orderId, currency: row.currency, fiatMinor: row.fiat_amount });
    updateOrder(orderId, { payment_ref: payout.payoutRef, settled_at: Date.now() });
    publish("order.settled", { orderId, route: "float", payoutRef: payout.payoutRef });
  } catch (err) {
    console.error("[orchestrator] slash+float failed:", err);
  }
}

let pollTimer: NodeJS.Timeout | null = null;
export function startOrchestrator() {
  pollTimer = setInterval(() => {
    const stuckOpen = db.prepare("SELECT order_id FROM orders WHERE status = 'open'").all() as { order_id: string }[];
    for (const r of stuckOpen) void tryRoute(r.order_id as Hex);
    const stuckAccepted = db.prepare("SELECT order_id FROM orders WHERE status = 'accepted'").all() as { order_id: string }[];
    for (const r of stuckAccepted) void handleLPAcceptedTimeout(r.order_id as Hex);
  }, 1000);
}
export function stopOrchestrator() {
  if (pollTimer) clearInterval(pollTimer);
}

export function startEventWatchers() {
  publicClient.watchContractEvent({
    address: dep.settlement, abi: settlementAbi, eventName: "OrderCreated", pollingInterval: 1000,
    onLogs(logs) {
      for (const log of logs) {
        const a = (log as unknown as { args: Record<string, bigint | string> }).args;
        const orderId = a.orderId as string;
        if (getOrder(orderId)) continue;
        recordOrder({
          order_id: orderId, order_ref: "",
          merchant_id: a.merchantId as string, payer: a.payer as string,
          fiat_amount: Number(a.fiatAmount as bigint),
          currency: Buffer.from((a.currency as string).slice(2), "hex").toString("ascii"),
          usdc_amount: String(a.usdcAmount as bigint),
          status: "open", route: null, assigned_lp: null,
          payment_ref: null, net_amount: null, fee: null,
          created_at: Date.now(), open_until: Number(a.openUntil as bigint),
          pay_deadline: null, settled_at: null,
          tx_create: (log as unknown as { transactionHash: string }).transactionHash,
          tx_accept: null, tx_mark_paid: null, tx_route: null, tx_settle: null,
        });
        publish("order.created", {
          orderId, merchantId: a.merchantId, payer: a.payer,
          fiatAmount: Number(a.fiatAmount), usdcAmount: String(a.usdcAmount),
          currency: Buffer.from((a.currency as string).slice(2), "hex").toString("ascii"),
          openUntil: Number(a.openUntil),
          txHash: (log as unknown as { transactionHash: string }).transactionHash,
          explorer: explorerTx((log as unknown as { transactionHash: `0x${string}` }).transactionHash),
        });
      }
    },
  });

  publicClient.watchContractEvent({
    address: dep.settlement, abi: settlementAbi, eventName: "OrderAccepted", pollingInterval: 1000,
    onLogs(logs) {
      for (const log of logs) {
        const a = (log as unknown as { args: Record<string, string | bigint> }).args;
        updateOrder(a.orderId as string, {
          status: "accepted", assigned_lp: a.lp as string,
          pay_deadline: Number(a.payDeadline as bigint),
          tx_accept: (log as unknown as { transactionHash: string }).transactionHash,
        });
        publish("order.accepted", { orderId: a.orderId, lp: a.lp, payDeadline: Number(a.payDeadline) });
      }
    },
  });

  publicClient.watchContractEvent({
    address: dep.settlement, abi: settlementAbi, eventName: "LPMarkedPaid", pollingInterval: 1000,
    onLogs(logs) {
      for (const log of logs) {
        const a = (log as unknown as { args: Record<string, string> }).args;
        updateOrder(a.orderId, {
          status: "lp_paid", payment_ref: a.paymentRef,
          tx_mark_paid: (log as unknown as { transactionHash: string }).transactionHash,
        });
        publish("order.marked_paid", { orderId: a.orderId, lp: a.lp, paymentRef: a.paymentRef });
      }
    },
  });

  publicClient.watchContractEvent({
    address: dep.settlement, abi: settlementAbi, eventName: "OrderSettled", pollingInterval: 1000,
    onLogs(logs) {
      for (const log of logs) {
        const a = (log as unknown as { args: Record<string, string | bigint | number> }).args;
        updateOrder(a.orderId as string, {
          status: "settled", route: "p2p",
          net_amount: String(a.netAmount as bigint), fee: String(a.fee as bigint),
          settled_at: Date.now(),
          tx_settle: (log as unknown as { transactionHash: string }).transactionHash,
        });
        publish("order.settled", {
          orderId: a.orderId, route: "p2p",
          netAmount: String(a.netAmount), fee: String(a.fee), recipient: a.recipient,
        });
      }
    },
  });

  publicClient.watchContractEvent({
    address: dep.settlement, abi: settlementAbi, eventName: "OrderRouted", pollingInterval: 1000,
    onLogs(logs) {
      for (const log of logs) {
        const a = (log as unknown as { args: Record<string, string | number> }).args;
        const route = Number(a.route) === 2 ? "offramp" : Number(a.route) === 3 ? "float" : "unknown";
        updateOrder(a.orderId as string, {
          status: route === "offramp" ? "routed_offramp" : "routed_float",
          route,
          tx_route: (log as unknown as { transactionHash: string }).transactionHash,
        });
        publish("order.routed", { orderId: a.orderId, route, destination: a.destination });
      }
    },
  });

  publicClient.watchContractEvent({
    address: dep.settlement, abi: settlementAbi, eventName: "OrderDisputed", pollingInterval: 1000,
    onLogs(logs) {
      for (const log of logs) {
        const a = (log as unknown as { args: Record<string, string> }).args;
        publish("order.disputed", { orderId: a.orderId, by: a.by, reason: a.reason });
      }
    },
  });

  publicClient.watchContractEvent({
    address: dep.settlement, abi: settlementAbi, eventName: "OrderRefunded", pollingInterval: 1000,
    onLogs(logs) {
      for (const log of logs) {
        const a = (log as unknown as { args: Record<string, string> }).args;
        updateOrder(a.orderId, { status: "refunded" });
        publish("order.refunded", { orderId: a.orderId, to: a.to });
      }
    },
  });
}
