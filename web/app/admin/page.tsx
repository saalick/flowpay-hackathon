"use client";
import { useCallback, useEffect, useState } from "react";
import { api, type Flag, type Order } from "@/lib/api";
import { useWs } from "@/lib/ws";
import { OrderCard } from "@/components/OrderCard";
import { useToast } from "@/components/Toast";

const KNOWN_FLAGS: { key: string; label: string; sub: string; options: string[] }[] = [
  { key: "offramp.enabled", label: "Offramp", sub: "Enable or disable the licensed-offramp route.", options: ["true", "false"] },
  { key: "float.enabled",   label: "Float",   sub: "Enable or disable the baht float fallback.",     options: ["true", "false"] },
  { key: "FORCE_ROUTE",     label: "Force route", sub: "Pin all new orders onto a specific route (for the demo).", options: ["", "p2p", "offramp", "float", "refund"] },
];

export default function AdminPage() {
  const [flags, setFlags] = useState<Record<string, string>>({});
  const [orders, setOrders] = useState<Order[]>([]);
  const toast = useToast();

  const refresh = useCallback(() => {
    api.flags().then((r) => {
      const m: Record<string, string> = {};
      for (const f of r.flags as Flag[]) m[f.key] = f.value;
      setFlags(m);
    });
    api.orders({ limit: 30 }).then((r) => setOrders(r.orders));
  }, []);

  useEffect(() => { refresh(); }, [refresh]);
  useWs((ev) => {
    const t = ev.type?.toString() ?? "";
    if (t === "admin.flag" || t.startsWith("order.")) refresh();
  });

  async function setFlag(key: string, value: string) {
    try {
      await api.setFlag(key, value);
      toast.push({ kind: "good", title: `${key} = ${value || "(cleared)"}` });
    } catch (e) {
      toast.push({ kind: "bad", title: "Flag failed", sub: (e as Error).message });
    }
    refresh();
  }

  return (
    <div className="wide">
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h1 className="display text-3xl md:text-4xl">Admin control panel</h1>
          <p className="text-sm text-inkMuted max-w-prose">
            Flags toggle the orchestrator's route decisions in real time. Set <b>FORCE_ROUTE</b> to pin new orders onto a specific route for the demo.
          </p>
        </div>
        <span className="chip-orange">live · WebSocket</span>
      </div>

      <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {KNOWN_FLAGS.map((f) => (
          <div key={f.key} className="card space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <div className="display text-lg">{f.label}</div>
                <div className="text-xs text-inkMuted font-mono">{f.key}</div>
              </div>
              <span className="chip">{flags[f.key] ?? "—"}</span>
            </div>
            <p className="text-xs text-inkMuted">{f.sub}</p>
            <div className="flex flex-wrap gap-2">
              {f.options.map((opt) => {
                const active = flags[f.key] === opt;
                return (
                  <button
                    key={opt}
                    onClick={() => setFlag(f.key, opt)}
                    className={`pill-btn text-sm py-2 px-3 ${
                      active
                        ? f.key === "FORCE_ROUTE" && opt === "refund"
                          ? "bg-pink"
                          : f.key === "FORCE_ROUTE" && opt === "float"
                          ? "bg-orange"
                          : f.key === "FORCE_ROUTE" && opt === "offramp"
                          ? "bg-purple"
                          : f.key === "FORCE_ROUTE" && opt === "p2p"
                          ? "bg-mint"
                          : "bg-ink text-cream"
                        : "bg-cream"
                    }`}
                  >
                    {opt === "" ? "(clear)" : opt}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="display text-xl">Recent orders</h2>
          <span className="chip">{orders.length}</span>
        </div>
        {orders.length === 0 ? (
          <div className="card text-inkMuted">No orders yet. Make a payment from /pay.</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {orders.map((o) => (
              <OrderCard key={o.id} order={o} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
