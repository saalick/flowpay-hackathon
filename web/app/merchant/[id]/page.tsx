"use client";
import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { api, type Order } from "@/lib/api";
import { useWs } from "@/lib/ws";
import { OrderCard } from "@/components/OrderCard";
import { useToast } from "@/components/Toast";

export default function MerchantPage() {
  const params = useParams<{ id: string }>();
  const merchantId = params.id;
  const [orders, setOrders] = useState<Order[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);
  const toast = useToast();
  const payUrl = typeof window !== "undefined" ? `${window.location.origin}/pay` : "";

  const refresh = useCallback(() => {
    if (!merchantId) return;
    api.orders({ merchantId, limit: 20 }).then((r) => setOrders(r.orders));
  }, [merchantId]);

  useEffect(() => { refresh(); }, [refresh]);
  useWs((ev) => {
    if (ev.type?.toString().startsWith("order.")) {
      refresh();
      if (ev.type === "order.created") toast.push({ kind: "info", title: "New order", sub: "Scroll down to confirm or dispute." });
      if (ev.type === "order.paid") toast.push({ kind: "good", title: "Order paid" });
    }
  });

  async function confirm(id: string) {
    setBusyId(id);
    try {
      const r = await api.confirm(id);
      toast.push({ kind: "good", title: "markPaid submitted", sub: r.txHash });
    } catch (e) {
      toast.push({ kind: "bad", title: "Confirm failed", sub: (e as Error).message });
    } finally {
      setBusyId(null);
      refresh();
    }
  }

  async function dispute(id: string) {
    const reason = prompt("Reason for dispute?") ?? "";
    if (!reason) return;
    setBusyId(id);
    try {
      await api.dispute(id, reason);
      toast.push({ kind: "info", title: "Dispute logged", sub: "Will route to float / refund." });
    } catch (e) {
      toast.push({ kind: "bad", title: "Dispute failed", sub: (e as Error).message });
    } finally {
      setBusyId(null);
      refresh();
    }
  }

  return (
    <div className="wide">
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h1 className="display text-3xl md:text-4xl">Merchant terminal</h1>
          <div className="text-xs text-inkMuted font-mono break-all max-w-prose">id {merchantId}</div>
        </div>
        <span className="chip-orange">live · WebSocket</span>
      </div>

      <section className="card-forest space-y-2">
        <div className="display text-base text-cream/90">Tourist payment link</div>
        <div className="font-mono text-xs break-all text-cream/70">{payUrl}</div>
        <button
          className="pill-btn-mint text-sm w-fit"
          onClick={() => navigator.clipboard.writeText(payUrl)}
        >
          Copy link
        </button>
      </section>

      <section className="space-y-3">
        <h2 className="display text-xl">Incoming orders</h2>
        {orders.length === 0 ? (
          <div className="card text-inkMuted">No orders yet.</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {orders.map((o) => (
              <div key={o.id} className="space-y-2">
                <OrderCard order={o} />
                {(o.status === "accepted" || o.status === "open" || o.status === "paid") && (
                  <div className="flex gap-2">
                    <button
                      className="pill-btn-mint flex-1 text-sm py-2"
                      disabled={busyId === o.id || o.status === "paid"}
                      onClick={() => confirm(o.id)}
                    >
                      Confirm
                    </button>
                    <button
                      className="pill-btn flex-1 text-sm py-2 bg-pink"
                      disabled={busyId === o.id || o.status === "paid"}
                      onClick={() => dispute(o.id)}
                    >
                      Dispute
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
