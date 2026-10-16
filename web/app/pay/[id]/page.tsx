"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { api, type Order } from "@/lib/api";
import { useWs } from "@/lib/ws";
import { EXPLORER } from "@/lib/wagmi";
import { Shell, TopBar, BackButton } from "@/components/PhoneShell";

const ROUTE_COPY: Record<string, { badge: string; title: string; sub: string; color: string }> = {
  p2p:     { badge: "P2P LP",   title: "Matched with a local LP", sub: "They send baht to the merchant.", color: "card-mint" },
  offramp: { badge: "Offramp",  title: "Offramp settling", sub: "Baht going out via licensed partner.", color: "card-purple" },
  float:   { badge: "Float",    title: "FlowPay float covered it", sub: "Baht paid from our shared float.", color: "card-orange" },
};

const STATUS_COPY: Record<string, string> = {
  created:        "Submitting onchain…",
  open:           "Looking for a liquidity provider…",
  accepted:       "LP accepted · waiting for baht delivery",
  lp_paid:        "LP marked baht sent · settling onchain",
  routed_offramp: "Routed to simulated offramp",
  routed_float:   "Routed to FlowPay float",
  settled:        "Settled onchain",
  refunded:       "Refunded",
  disputed:       "Disputed · engine falling back",
};

const DONE_STATUSES = new Set(["settled", "lp_paid", "routed_offramp", "routed_float"]);

export default function OrderPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const [order, setOrder] = useState<Order | null>(null);

  const refresh = useCallback(() => {
    if (!id) return;
    api.order(id).then(setOrder).catch(() => void 0);
  }, [id]);

  useEffect(() => {
    refresh();
    const t = setInterval(refresh, 2000);
    return () => clearInterval(t);
  }, [refresh]);
  useWs((ev) => { if (ev.type?.toString().startsWith("order.")) refresh(); });

  if (!order) {
    return (
      <Shell>
        <TopBar left={<BackButton href="/home" />} title="Order" />
        <div className="card text-center">Loading…</div>
      </Shell>
    );
  }

  const fiat = Number(order.fiatAmount) / 100;
  const usdc = Number(order.usdcAmount) / 1e6;
  const done = DONE_STATUSES.has(order.status);
  const refunded = order.status === "refunded";
  const route = order.route ? ROUTE_COPY[order.route] : null;

  return (
    <Shell>
      <TopBar left={<BackButton href="/home" />} title="Payment" />

      <section className={`${done ? "card-mint" : refunded ? "card-pink" : "card-forest"} space-y-3 text-center`}>
        <div className="text-xs uppercase font-bold tracking-wider opacity-80">
          {done ? "Settled" : refunded ? "Refunded" : "Processing"}
        </div>
        <div className="display text-5xl leading-none">
          ฿{fiat.toFixed(2)}
        </div>
        <div className={`text-sm ${done || refunded ? "text-ink/80" : "text-cream/80"}`}>
          {usdc.toFixed(4)} USDC
        </div>
        {done && <div className="text-4xl animate-pop">✓</div>}
      </section>

      <section className="card space-y-2">
        <div className="display text-base">Status</div>
        <div className="text-sm">{STATUS_COPY[order.status] ?? order.status}</div>
        {route && (
          <div className={`${route.color} mt-2`}>
            <div className="flex items-center justify-between">
              <span className="chip">{route.badge}</span>
            </div>
            <div className="display text-lg mt-2">{route.title}</div>
            <div className="text-sm text-ink/80">{route.sub}</div>
          </div>
        )}
        {order.lp && (
          <div className="text-xs text-inkMuted font-mono break-all">lp {order.lp}</div>
        )}
        {order.disputeReason && (
          <div className="text-xs text-bad">dispute: {order.disputeReason}</div>
        )}
      </section>

      <section className="card space-y-2">
        <div className="display text-base">Onchain</div>
        <div className="text-xs text-inkMuted">Order ID</div>
        <div className="font-mono text-xs break-all">{order.id}</div>
        {order.payTx && (
          <a className="link text-sm" href={`${EXPLORER}/tx/${order.payTx}`} target="_blank" rel="noreferrer">
            View pay tx on Snowtrace ↗
          </a>
        )}
        {order.settleTx && (
          <a className="link text-sm" href={`${EXPLORER}/tx/${order.settleTx}`} target="_blank" rel="noreferrer">
            View settle tx on Snowtrace ↗
          </a>
        )}
      </section>

      <div className="flex gap-3">
        <Link href="/home" className="pill-btn-mint flex-1">Home</Link>
        <Link href="/pay" className="pill-btn-orange flex-1">Pay again</Link>
      </div>
    </Shell>
  );
}
