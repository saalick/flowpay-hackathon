"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { api, type Deployment } from "@/lib/api";

export default function MerchantIndex() {
  const [dep, setDep] = useState<Deployment | null>(null);
  useEffect(() => { api.deployment().then(setDep); }, []);
  const id = dep?.demoMerchantId;
  return (
    <div className="wide">
      <h1 className="display text-3xl md:text-4xl">Merchant terminal</h1>
      <p className="text-sm text-inkMuted max-w-prose">
        Each merchant has their own id and page. For the demo, we expose one shared merchant below.
      </p>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="card-mint space-y-3">
          <div className="display text-lg">Demo merchant</div>
          <p className="text-sm">Share this terminal with a vendor. They'll see every payment live and can confirm or dispute with one tap.</p>
          {id && (
            <Link className="pill-btn-dark w-full" href={`/merchant/${id}`}>
              Open demo merchant →
            </Link>
          )}
          {id && <div className="text-xs font-mono text-inkMuted break-all">id {id}</div>}
        </div>
        <div className="card space-y-2">
          <div className="display text-lg">How it works</div>
          <ol className="text-sm list-decimal pl-5 space-y-1">
            <li>Tourist pays in USDC via /pay.</li>
            <li>The settlement engine picks the best route (P2P LP → offramp → float).</li>
            <li>Merchant taps <b>Confirm received</b> → onchain markPaid.</li>
            <li>Or taps <b>Not received</b> → engine falls back and refunds if needed.</li>
          </ol>
        </div>
      </div>
    </div>
  );
}
