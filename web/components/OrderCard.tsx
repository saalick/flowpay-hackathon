"use client";
import type { Order } from "@/lib/api";
import { EXPLORER } from "@/lib/wagmi";

const STATUS: Record<string, { label: string; cls: string }> = {
  created:  { label: "created",  cls: "chip" },
  open:     { label: "open",     cls: "chip-orange" },
  accepted: { label: "accepted", cls: "chip-mint" },
  paid:     { label: "paid",     cls: "chip-mint" },
  routed:   { label: "routed",   cls: "chip-mint" },
  refunded: { label: "refunded", cls: "chip-pink" },
  disputed: { label: "disputed", cls: "chip-pink" },
};

export function OrderCard({ order }: { order: Order }) {
  const fiat = Number(order.fiatAmount) / 100;
  const usdc = Number(order.usdcAmount) / 1e6;
  const s = STATUS[order.status] ?? { label: order.status, cls: "chip" };

  return (
    <div className="card space-y-2">
      <div className="flex items-center justify-between">
        <div className="font-mono text-xs text-inkMuted">{order.id.slice(0, 10)}…</div>
        <div className="flex gap-1 flex-wrap justify-end">
          <span className={s.cls}>{s.label}</span>
          {order.route && <span className="chip">{order.route}</span>}
        </div>
      </div>
      <div className="display text-2xl">
        ฿{fiat.toFixed(2)}
        <span className="text-inkMuted font-normal text-sm ml-2">from {usdc.toFixed(4)} USDC</span>
      </div>
      <div className="text-xs text-inkMuted font-mono truncate">payer {order.payer}</div>
      {order.lp && <div className="text-xs text-inkMuted font-mono truncate">lp {order.lp}</div>}
      <div className="flex gap-3 text-xs">
        {order.payTx && (
          <a className="link" href={`${EXPLORER}/tx/${order.payTx}`} target="_blank" rel="noreferrer">
            pay tx ↗
          </a>
        )}
        {order.settleTx && (
          <a className="link" href={`${EXPLORER}/tx/${order.settleTx}`} target="_blank" rel="noreferrer">
            settle tx ↗
          </a>
        )}
      </div>
      {order.disputeReason && (
        <div className="text-xs text-bad font-semibold">dispute: {order.disputeReason}</div>
      )}
    </div>
  );
}
