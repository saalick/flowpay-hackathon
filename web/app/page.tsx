"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAccount, useConnect } from "wagmi";

export default function Landing() {
  const router = useRouter();
  const { isConnected } = useAccount();
  const { connectors, connect, isPending } = useConnect();

  useEffect(() => {
    if (isConnected) router.replace("/home");
  }, [isConnected, router]);

  const injected = connectors[0];
  const safeConnect = () => {
    if (!injected) return;
    connect({ connector: injected }, {
      onError: (err) => {
        if (!/reject/i.test(err.message)) alert(err.message);
      },
    });
  };

  const Hero = () => (
    <div className="flex-1 flex flex-col justify-center items-center md:items-start text-center md:text-left gap-4 md:gap-5">
      <span className="chip bg-cream text-ink border-ink">⚡ Live on Avalanche Fuji · testnet</span>
      <h1 className="display text-5xl sm:text-6xl md:text-6xl lg:text-7xl leading-[0.9] tracking-tight">
        SCAN.
        <br />
        PAY.
        <br />
        <span className="bg-cream px-3 md:px-4 py-1 md:py-2 inline-block border-2 border-ink shadow-brutalLg rounded-xl mt-2">
          FLOWPAY.
        </span>
      </h1>
      <p className="text-sm md:text-base max-w-[380px] md:max-w-[480px] text-ink/80 font-medium">
        Scan any local payment prompt and pay instantly in USDC — the merchant receives local cash. Three onchain routes, auto-fallback, settled in seconds.
      </p>
      <div className="hidden md:flex flex-wrap gap-2">
        <span className="chip bg-cream text-ink border-ink">USDC in · Baht out</span>
        <span className="chip bg-cream text-ink border-ink">P2P · Offramp · Float</span>
        <span className="chip bg-cream text-ink border-ink">~2s settle</span>
      </div>
    </div>
  );

  const CTA = () => (
    <div className="flex flex-col gap-3 w-full md:max-w-[520px]">
      <button
        className="pill-btn-primary w-full py-4 text-base"
        disabled={!injected || isPending}
        onClick={safeConnect}
      >
        {isPending ? "Connecting…" : "Log in with wallet  →"}
      </button>
      <Link href="/home" className="text-center text-sm font-display font-bold underline underline-offset-2">
        Explore without connecting
      </Link>
    </div>
  );

  const Preview = () => (
    <div className="flex flex-col gap-5 w-full max-w-md mx-auto">
      <div className="card-forest space-y-3 rotate-[-1.5deg]">
        <span className="chip bg-forest text-cream border-cream/40">Sell Rate: ฿36.14</span>
        <div>
          <div className="text-cream/70 text-[10px] uppercase font-bold tracking-wider">USDC balance</div>
          <div className="display text-5xl mt-1 leading-none">
            24<span className="text-cream/60 text-2xl align-top">.86</span>
          </div>
          <div className="text-cream/70 mt-1 text-xs">≈ ฿898.44</div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div className="pill-btn-purple text-sm py-2 cursor-default pointer-events-none">↙ Deposit</div>
          <div className="pill-btn-orange text-sm py-2 cursor-default pointer-events-none">↗ Withdraw</div>
        </div>
      </div>

      <div className="card-mint rotate-[1.5deg] flex items-center justify-between">
        <div>
          <div className="text-[10px] uppercase font-bold tracking-wider text-ink/70">Scan &amp; Pay</div>
          <div className="display text-3xl mt-1 leading-none">฿180</div>
          <div className="text-xs text-inkMuted mt-1">≈ 4.98 USDC · 0.52s to float</div>
        </div>
        <span className="text-4xl animate-pop">✓</span>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <div className="card p-3 text-center">
          <div className="display text-xl">3</div>
          <div className="text-[10px] text-inkMuted">routes</div>
        </div>
        <div className="card p-3 text-center">
          <div className="display text-xl">&lt;2s</div>
          <div className="text-[10px] text-inkMuted">to settle</div>
        </div>
        <div className="card p-3 text-center">
          <div className="display text-xl">0</div>
          <div className="text-[10px] text-inkMuted">voice calls</div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen md:grid md:grid-cols-2">
      {/* mobile: single column, orange, phone-shell style */}
      <div className="shell bg-orange text-ink md:hidden">
        <Hero />
        <div className="pt-4">
          <CTA />
        </div>
      </div>

      {/* desktop: split hero */}
      <section className="hidden md:flex relative bg-orange text-ink flex-col justify-between gap-6 px-10 lg:px-14 xl:px-20 py-8 overflow-hidden">
        <span className="absolute top-10 right-12 text-5xl rotate-12 opacity-80">✦</span>
        <span className="absolute bottom-24 left-10 text-4xl -rotate-12 opacity-60">✦</span>
        <span className="absolute top-1/3 left-1/2 text-3xl opacity-50 rotate-6">✧</span>
        <Link href="/" className="display text-xl inline-flex items-center gap-3 text-ink">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="https://i.ibb.co/wZfcp6DG/Neon-F-Flow-Emblem.png"
            alt="FlowPay"
            className="w-11 h-11 rounded-full border-2 border-ink shadow-brutal object-cover bg-bg"
          />
          FlowPay
        </Link>
        <Hero />
        <CTA />
      </section>

      <section className="hidden md:flex relative flex-col justify-between gap-6 px-10 lg:px-14 xl:px-20 py-8 overflow-hidden">
        <span className="absolute top-16 right-14 text-4xl text-orange rotate-6 opacity-70">★</span>
        <span className="absolute bottom-32 right-10 text-3xl text-purple -rotate-12 opacity-80">✧</span>
        <nav className="flex justify-end gap-2">
          <Link href="/dash" className="chip">Dev dashboard</Link>
          <a href="https://testnet.snowtrace.io/address/0x1f1604dF4B60Df2176E5585900e0A783aFFbec17" target="_blank" rel="noreferrer" className="chip-mint">Snowtrace ↗</a>
        </nav>
        <div className="flex-1 flex items-center justify-center py-10">
          <Preview />
        </div>
        <div className="text-xs text-inkMuted font-mono text-center">
          Settlement 0x1f16…bec17 · Treasury 0x7c47…99F2 · USDC 0x5425…Bc65
        </div>
      </section>
    </div>
  );
}
