"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { useAccount } from "wagmi";
import { api, type LP, type Order } from "@/lib/api";
import { useWs } from "@/lib/ws";
import { OrderCard } from "@/components/OrderCard";
import { useToast } from "@/components/Toast";

export default function LPPage() {
  const { address, isConnected } = useAccount();
  const [lps, setLps] = useState<LP[]>([]);
  const [myLp, setMyLp] = useState<LP | null>(null);
  const [openOrders, setOpenOrders] = useState<Order[]>([]);
  const [displayName, setDisplayName] = useState("demo-lp");
  const [rail, setRail] = useState("PROMPTPAY");
  const [currency, setCurrency] = useState("THB");
  const [autoAccept, setAutoAccept] = useState(false);
  const alertRef = useRef<HTMLAudioElement | null>(null);
  const toast = useToast();

  const refresh = useCallback(() => {
    api.lps().then((r) => setLps(r.lps)).catch(() => void 0);
    api.orders({ status: "open", limit: 20 }).then((r) => setOpenOrders(r.orders)).catch(() => void 0);
    if (address) {
      api.lp(address).then(setMyLp).catch(() => setMyLp(null));
    }
  }, [address]);

  useEffect(() => { refresh(); }, [refresh]);
  useWs((ev) => {
    const t = ev.type?.toString() ?? "";
    if (t.startsWith("order.") || t === "lp.updated") {
      refresh();
      if (t === "order.created") {
        try { alertRef.current?.play(); } catch { /* noop */ }
        toast.push({ kind: "info", title: "New open order", sub: "Check the market below." });
      }
    }
  });

  async function announce() {
    if (!address) return;
    try {
      await api.announceLp({
        address,
        displayName,
        rail,
        currency,
        online: true,
        autoAccept,
      });
      toast.push({ kind: "good", title: "LP announced" });
      refresh();
    } catch (e) {
      toast.push({ kind: "bad", title: "Announce failed", sub: (e as Error).message });
    }
  }

  async function toggleOnline(online: boolean) {
    if (!address) return;
    await api.updateLp({ address, online });
    toast.push({ kind: "good", title: online ? "LP online" : "LP paused" });
    refresh();
  }

  async function toggleAuto(auto: boolean) {
    if (!address) return;
    await api.updateLp({ address, autoAccept: auto });
    toast.push({ kind: "good", title: auto ? "Auto-accept on" : "Auto-accept off" });
    refresh();
  }

  const activeCount = lps.filter((l) => l.online === 1).length;

  return (
    <div className="wide">
      <audio
        ref={alertRef}
        src="data:audio/wav;base64,UklGRkQAAABXQVZFZm10IBAAAAABAAEAgD4AAIA+AAABAAgAZGF0YSAAAAB/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f38="
        preload="auto"
      />

      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h1 className="display text-3xl md:text-4xl">Liquidity provider</h1>
          <p className="text-sm text-muted max-w-prose">Announce your handle and rail. New open orders ping with sound.</p>
        </div>
        <span className="chip-mint">{activeCount} online · {lps.length} total</span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <section className="card space-y-3 lg:col-span-1">
          <h2 className="display text-lg">You</h2>
          {!isConnected ? (
            <div className="text-sm text-muted">Connect wallet to register.</div>
          ) : myLp ? (
            <>
              <div className="text-sm">
                <b>{myLp.displayName}</b><br />
                <span className="text-muted">rail {myLp.rail} · {myLp.currency}</span>
              </div>
              <div className="text-sm">
                Status:{" "}
                <span className={myLp.online === 1 ? "text-good font-bold" : "text-bad font-bold"}>
                  {myLp.online === 1 ? "online" : "paused"}
                </span>
                {" · "}
                <span className={myLp.autoAccept === 1 ? "text-cyan font-bold" : "text-muted font-bold"}>
                  auto-accept {myLp.autoAccept === 1 ? "on" : "off"}
                </span>
              </div>
              {myLp.stake && (
                <div className="text-xs text-muted">
                  Stake: {(Number(myLp.stake.total) / 1e6).toFixed(2)} USDC
                  · locked {(Number(myLp.stake.locked) / 1e6).toFixed(2)}
                  · registered {String(myLp.stake.registered)}
                </div>
              )}
              <div className="flex gap-2 flex-wrap">
                <button className="pill-btn-ghost" onClick={() => toggleOnline(myLp.online !== 1)}>
                  {myLp.online === 1 ? "Pause" : "Resume"}
                </button>
                <button className="pill-btn-mint" onClick={() => toggleAuto(myLp.autoAccept !== 1)}>
                  {myLp.autoAccept === 1 ? "Auto-accept off" : "Auto-accept on"}
                </button>
              </div>
            </>
          ) : (
            <div className="space-y-2">
              <label className="text-xs block">Display name
                <input className="input mt-1" value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
              </label>
              <label className="text-xs block">Rail
                <input className="input mt-1" value={rail} onChange={(e) => setRail(e.target.value)} />
              </label>
              <label className="text-xs block">Currency
                <input className="input mt-1" value={currency} onChange={(e) => setCurrency(e.target.value)} />
              </label>
              <label className="flex items-center gap-2 text-xs">
                <input type="checkbox" checked={autoAccept} onChange={(e) => setAutoAccept(e.target.checked)} />
                Auto-accept new orders
              </label>
              <button className="pill-btn-orange w-full" onClick={announce}>Announce LP</button>
            </div>
          )}
        </section>

        <section className="lg:col-span-2 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="display text-xl">Open orders · live</h2>
            <span className="chip-orange">{openOrders.length}</span>
          </div>
          {openOrders.length === 0 ? (
            <div className="card text-muted">No open orders. Set <b>FORCE_ROUTE=p2p</b> in /admin and pay to make one appear.</div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {openOrders.map((o) => (
                <OrderCard key={o.id} order={o} />
              ))}
            </div>
          )}
          <p className="text-xs text-muted">
            Open orders are live via WebSocket. LP-side accept requires staking USDC in <code>LPRegistry</code> first — see README.
          </p>
        </section>
      </div>

      <section className="space-y-3">
        <h2 className="display text-xl">LP market</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {lps.map((lp) => (
            <div key={lp.address} className="card space-y-1 text-sm">
              <div className="flex items-center justify-between">
                <b>{lp.displayName}</b>
                <span className={lp.online === 1 ? "chip-mint" : "chip"}>{lp.online === 1 ? "online" : "paused"}</span>
              </div>
              <div className="font-mono text-xs text-muted truncate">{lp.address}</div>
              <div className="text-xs">rail {lp.rail} · {lp.currency}{lp.autoAccept === 1 ? " · auto-accept" : ""}</div>
            </div>
          ))}
          {lps.length === 0 && <div className="card text-muted">No LPs registered yet.</div>}
        </div>
      </section>
    </div>
  );
}
