"use client";
import { useState, useEffect } from "react";
import { useAccount } from "wagmi";
import { api, type Deployment } from "@/lib/api";
import { explorerAddr } from "@/lib/wagmi";
import { Shell, TopBar, BackButton } from "@/components/PhoneShell";

export default function DepositPage() {
  const { address, isConnected } = useAccount();
  const [dep, setDep] = useState<Deployment | null>(null);

  useEffect(() => { api.deployment().then(setDep).catch(() => void 0); }, []);

  return (
    <Shell>
      <TopBar left={<BackButton href="/home" />} title="Deposit" />
      <h2 className="display text-3xl leading-tight">Deposit MockUSDC on Fuji</h2>
      <p className="text-sm text-muted">
        Send Mock USDC to your wallet address. This is a testnet token with a public <code>mint</code> — anyone can top you up with the snippet below.
      </p>

      <section className="card space-y-3">
        <div className="display text-base">Your deposit address</div>
        {isConnected ? (
          <>
            <div className="input break-all text-xs">{address}</div>
            <button
              className="pill-btn-mint w-full"
              onClick={() => { if (address) navigator.clipboard.writeText(address); }}
            >
              Copy address
            </button>
          </>
        ) : (
          <p className="text-sm text-muted">Connect your wallet to see your deposit address.</p>
        )}
      </section>

      {dep && (
        <section className="card space-y-2">
          <div className="display text-base">MockUSDC contract</div>
          <a className="link text-sm" href={dep.explorer.usdc} target="_blank" rel="noreferrer">
            {dep.usdc} ↗
          </a>
          <p className="text-xs text-muted">6 decimals · public <code>mint(address,uint256)</code>.</p>
          {isConnected && (
            <div className="input text-[11px] break-all font-mono select-all">
              cast send {dep.usdc} "mint(address,uint256)" {address} 10000000 --rpc-url https://api.avax-test.network/ext/bc/C/rpc --private-key &lt;yourPk&gt; --legacy --gas-limit 100000 --gas-price 30000000000
            </div>
          )}
        </section>
      )}
    </Shell>
  );
}
