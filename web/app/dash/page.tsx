"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { api, type Deployment } from "@/lib/api";
import { Shell, TopBar, BackButton } from "@/components/PhoneShell";

export default function DashIndex() {
  const [dep, setDep] = useState<Deployment | null>(null);
  useEffect(() => { api.deployment().then(setDep); }, []);
  return (
    <Shell>
      <TopBar left={<BackButton href="/home" />} title="Dev dashboard" />
      <p className="text-sm text-inkMuted">The judges-mode views. Watch the engine, force routes, pretend to be a merchant or an LP.</p>

      <Link href="/admin" className="card-orange flex items-center justify-between">
        <div>
          <div className="display text-lg">Admin control panel</div>
          <div className="text-sm">Force each of the 3 routes · toggle offramp/float</div>
        </div>
        <span className="icon-btn bg-ink text-cream">→</span>
      </Link>

      {dep && (
        <Link href={`/merchant/${dep.demoMerchantId}`} className="card-mint flex items-center justify-between">
          <div>
            <div className="display text-lg">Merchant terminal</div>
            <div className="text-sm">Confirm received · dispute</div>
          </div>
          <span className="icon-btn bg-ink text-cream">→</span>
        </Link>
      )}

      <Link href="/lp" className="card-purple flex items-center justify-between">
        <div>
          <div className="display text-lg">LP dashboard</div>
          <div className="text-sm">Register · see open orders · accept</div>
        </div>
        <span className="icon-btn bg-ink text-cream">→</span>
      </Link>

      {dep && (
        <section className="card space-y-2 text-xs font-mono break-all">
          <div className="display text-base">Deployment</div>
          <div>Settlement: <a className="link" href={dep.explorer.settlement} target="_blank" rel="noreferrer">{dep.settlement}</a></div>
          <div>Treasury: <a className="link" href={dep.explorer.treasury} target="_blank" rel="noreferrer">{dep.treasury}</a></div>
          <div>LPRegistry: <a className="link" href={dep.explorer.lpRegistry} target="_blank" rel="noreferrer">{dep.lpRegistry}</a></div>
          <div>TripFactory: <a className="link" href={dep.explorer.tripFactory} target="_blank" rel="noreferrer">{dep.tripFactory}</a></div>
          <div>USDC: <a className="link" href={dep.explorer.usdc} target="_blank" rel="noreferrer">{dep.usdc}</a></div>
        </section>
      )}
    </Shell>
  );
}
