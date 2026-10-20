"use client";
import React from "react";

type Slide = { title: React.ReactNode; body?: React.ReactNode };

const slides: Slide[] = [
  {
    title: (
      <div className="space-y-6 text-center">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="https://i.ibb.co/wZfcp6DG/Neon-F-Flow-Emblem.png" alt="FlowPay" className="w-24 h-24 mx-auto rounded-full border-2 border-ink shadow-brutal bg-bg" />
        <h1 className="display text-7xl md:text-8xl leading-[0.9]">FlowPay</h1>
        <div className="chip-cream inline-flex text-sm">⚡ Live on Avalanche Fuji · 2026‑10‑16</div>
        <p className="display text-2xl text-muted">Scan. Pay. Instantly.</p>
      </div>
    ),
  },
  {
    title: <h2 className="display text-5xl md:text-6xl">The problem.</h2>,
    body: (
      <div className="grid md:grid-cols-3 gap-5 max-w-5xl">
        <div className="card space-y-2"><div className="display text-xl text-pinkNeon">Tourists</div><p className="text-muted">arrive with crypto they can't spend</p></div>
        <div className="card space-y-2"><div className="display text-xl text-cyan">Merchants</div><p className="text-muted">only accept local cash — pesos, rupiah, peso</p></div>
        <div className="card space-y-2"><div className="display text-xl text-accent">Today's fix</div><p className="text-muted">bad kiosks, custodial apps that leak identity, or physical cash</p></div>
      </div>
    ),
  },
  {
    title: <h2 className="display text-5xl md:text-6xl"><span className="text-accent">USDC in.</span> Pesos out.</h2>,
    body: <p className="display text-2xl text-muted max-w-3xl text-center">Scan a local payment prompt. Pay in USDC. The merchant receives their local currency. Fully onchain. Fully anonymous.</p>,
  },
  {
    title: <h2 className="display text-5xl md:text-6xl">Three routes, one fallback.</h2>,
    body: (
      <div className="grid md:grid-cols-3 gap-5 max-w-5xl">
        <div className="card-mint space-y-2"><div className="chip">01</div><div className="display text-xl">P2P LP</div><p className="text-ink/80">Local liquidity provider delivers pesos. Stakes USDC — slashed if they fail.</p></div>
        <div className="card-purple space-y-2"><div className="chip">02</div><div className="display text-xl">Licensed offramp</div><p className="text-ink/80">Fallback to whitelisted licensed partner. Pesos in &lt;30 s.</p></div>
        <div className="card-orange space-y-2"><div className="chip">03</div><div className="display text-xl">Pesos float</div><p className="text-ink/80">FlowPay's own float covers it. LP slashed in parallel.</p></div>
      </div>
    ),
  },
  {
    title: <h2 className="display text-5xl md:text-6xl">How it works.</h2>,
    body: (
      <div className="space-y-4 max-w-3xl text-xl">
        <div className="card flex items-center gap-4"><span className="chip-orange">1</span><span>Tourist taps <b>Scan &amp; Pay</b>, enters the bill amount.</span></div>
        <div className="card flex items-center gap-4"><span className="chip-mint">2</span><span>Server signs an EIP‑712 Quote. Tourist's smart‑wallet calls <code>pay()</code>.</span></div>
        <div className="card flex items-center gap-4"><span className="chip-pink">3</span><span>FlowSettlement emits <code>OrderCreated</code>. Chain watcher reconciles at 1 Hz.</span></div>
        <div className="card flex items-center gap-4"><span className="chip-cream">4</span><span>Engine races the three routes, settles onchain, pesos delivered.</span></div>
      </div>
    ),
  },
  {
    title: <h2 className="display text-5xl md:text-6xl">What's live.</h2>,
    body: (
      <div className="grid md:grid-cols-2 gap-5 max-w-5xl">
        <div className="card space-y-2"><div className="display text-2xl text-accent">5 contracts on Fuji</div><p className="text-muted">FlowSettlement · TreasuryVault · LPRegistry · TripAccountFactory · MockUSDC</p></div>
        <div className="card space-y-2"><div className="display text-2xl text-cyan">27 Foundry tests</div><p className="text-muted">100% green. EIP‑1167 clones via CREATE2. On‑chain spend caps.</p></div>
        <div className="card space-y-2"><div className="display text-2xl text-pinkNeon">Gasless onboarding</div><p className="text-muted">Server deploys account + mints 10 USDC in 6 s. User signs zero gas.</p></div>
        <div className="card space-y-2"><div className="display text-2xl text-accent">Mobile‑first webapp</div><p className="text-muted">Next 15, wagmi 2, viem 2. Scan&Pay keypad, live Snowtrace links.</p></div>
      </div>
    ),
  },
  {
    title: <h2 className="display text-5xl md:text-6xl">Why Avalanche.</h2>,
    body: (
      <div className="grid md:grid-cols-3 gap-5 max-w-5xl">
        <div className="card space-y-2"><div className="display text-xl text-accent">Fast finality</div><p className="text-muted">Sub‑second confirmation keeps settle windows tight.</p></div>
        <div className="card space-y-2"><div className="display text-xl text-cyan">Cheap gas</div><p className="text-muted">Full onboard + payment under ¢1 on testnet. Mainnet sub‑cent.</p></div>
        <div className="card space-y-2"><div className="display text-xl text-pinkNeon">Native USDC</div><p className="text-muted">Circle USDC available on Avalanche today. MockUSDC for demo.</p></div>
      </div>
    ),
  },
  {
    title: (
      <div className="text-center space-y-8">
        <h2 className="display text-6xl md:text-7xl"><span className="text-accent">Try it.</span></h2>
        <div className="chip-cream text-sm inline-flex">live demo</div>
        <p className="display text-xl font-mono break-all max-w-3xl">flowpay-onzaxx6ig-saalicks-projects.vercel.app</p>
        <p className="text-muted">github.com/saalick/flowpay-hackathon</p>
      </div>
    ),
  },
];

export default function DeckPrint() {
  return (
    <>
      <style>{`
        @page { size: A4 landscape; margin: 0; }
        html, body { background: #0A0B0F !important; }
        .pslide {
          width: 100vw;
          height: 100vh;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 2rem;
          padding: 2.5rem 3rem;
          position: relative;
          overflow: hidden;
          page-break-after: always;
          background: #0A0B0F;
          color: #ECEEF2;
          -webkit-print-color-adjust: exact;
          print-color-adjust: exact;
        }
        .pslide:last-child { page-break-after: auto; }
        .spark { position: absolute; opacity: 0.5; font-size: 2.5rem; }
      `}</style>
      {slides.map((s, i) => (
        <section key={i} className="pslide">
          <span className="spark" style={{ top: 60, right: 80, color: "#B6FF3B", transform: "rotate(12deg)" }}>✦</span>
          <span className="spark" style={{ bottom: 60, left: 80, color: "#FF4FA3", transform: "rotate(-12deg)" }}>✦</span>
          <span className="spark" style={{ top: "50%", right: "30%", color: "#4ED1FF", fontSize: "1.75rem", transform: "rotate(6deg)" }}>✧</span>
          <div className="absolute top-5 left-6 flex items-center gap-2 text-sm">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="https://i.ibb.co/wZfcp6DG/Neon-F-Flow-Emblem.png" alt="" className="w-7 h-7 rounded-full border-2 border-ink bg-bg" />
            <span className="display">FlowPay</span>
          </div>
          <div className="absolute top-5 right-6 text-xs text-muted font-mono">{i + 1} / {slides.length}</div>
          {s.title}
          {s.body}
        </section>
      ))}
    </>
  );
}
