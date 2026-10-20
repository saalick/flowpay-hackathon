"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";

type Slide = { title: React.ReactNode; body?: React.ReactNode };

const slides: Slide[] = [
  {
    title: (
      <div className="space-y-6 text-center">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="https://i.ibb.co/wZfcp6DG/Neon-F-Flow-Emblem.png" alt="FlowPay" className="w-24 h-24 mx-auto rounded-full border-2 border-ink shadow-brutal bg-bg" />
        <h1 className="display text-7xl md:text-8xl leading-[0.9]">FlowPay</h1>
        <div className="chip-cream inline-flex text-sm">⚡ Live on Base Sepolia · 2026‑10‑16</div>
        <p className="display text-2xl text-muted">Scan. Pay. Instantly.</p>
      </div>
    ),
  },
  {
    title: <h2 className="display text-5xl md:text-6xl">The problem.</h2>,
    body: (
      <div className="grid md:grid-cols-3 gap-5 max-w-5xl">
        <div className="card space-y-2">
          <div className="display text-xl text-pinkNeon">Tourists</div>
          <p className="text-muted">arrive with crypto they can't spend</p>
        </div>
        <div className="card space-y-2">
          <div className="display text-xl text-cyan">Merchants</div>
          <p className="text-muted">only accept local cash — pesos, rupiah, peso</p>
        </div>
        <div className="card space-y-2">
          <div className="display text-xl text-accent">Today's fix</div>
          <p className="text-muted">bad kiosks, custodial apps that leak identity, or physical cash</p>
        </div>
      </div>
    ),
  },
  {
    title: <h2 className="display text-5xl md:text-6xl"><span className="text-accent">USDC in.</span> Pesos out.</h2>,
    body: (
      <p className="display text-2xl text-muted max-w-3xl text-center">
        Scan a local payment prompt. Pay in USDC. The merchant receives their local currency. Fully onchain. Fully anonymous.
      </p>
    ),
  },
  {
    title: <h2 className="display text-5xl md:text-6xl">Three routes, one fallback.</h2>,
    body: (
      <div className="grid md:grid-cols-3 gap-5 max-w-5xl">
        <div className="card-mint space-y-2">
          <div className="chip">01</div>
          <div className="display text-xl">P2P LP</div>
          <p className="text-ink/80">Local liquidity provider delivers pesos. Stakes USDC — slashed if they fail.</p>
        </div>
        <div className="card-purple space-y-2">
          <div className="chip">02</div>
          <div className="display text-xl">Licensed offramp</div>
          <p className="text-ink/80">Fallback to whitelisted licensed partner. Pesos in &lt;30 s.</p>
        </div>
        <div className="card-orange space-y-2">
          <div className="chip">03</div>
          <div className="display text-xl">Pesos float</div>
          <p className="text-ink/80">FlowPay's own float covers it. LP slashed in parallel.</p>
        </div>
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
        <div className="card space-y-2">
          <div className="display text-2xl text-accent">5 contracts on Fuji</div>
          <p className="text-muted">FlowSettlement · TreasuryVault · LPRegistry · TripAccountFactory · MockUSDC</p>
        </div>
        <div className="card space-y-2">
          <div className="display text-2xl text-cyan">27 Foundry tests</div>
          <p className="text-muted">100% green. EIP‑1167 clones via CREATE2. On‑chain spend caps.</p>
        </div>
        <div className="card space-y-2">
          <div className="display text-2xl text-pinkNeon">Gasless onboarding</div>
          <p className="text-muted">Server deploys account + mints 10 USDC in 6 s. User signs zero gas.</p>
        </div>
        <div className="card space-y-2">
          <div className="display text-2xl text-accent">Mobile‑first webapp</div>
          <p className="text-muted">Next 15, wagmi 2, viem 2. Scan&Pay keypad, live Snowtrace links.</p>
        </div>
      </div>
    ),
  },
  {
    title: <h2 className="display text-5xl md:text-6xl">Why Base.</h2>,
    body: (
      <div className="grid md:grid-cols-3 gap-5 max-w-5xl">
        <div className="card space-y-2">
          <div className="display text-xl text-accent">Fast finality</div>
          <p className="text-muted">Sub‑second confirmation keeps settle windows tight.</p>
        </div>
        <div className="card space-y-2">
          <div className="display text-xl text-cyan">Cheap gas</div>
          <p className="text-muted">Full onboard + payment under ¢1 on testnet. Mainnet sub‑cent.</p>
        </div>
        <div className="card space-y-2">
          <div className="display text-xl text-pinkNeon">Native USDC</div>
          <p className="text-muted">Circle USDC available on Base today. MockUSDC for demo.</p>
        </div>
      </div>
    ),
  },
  {
    title: (
      <div className="text-center space-y-8">
        <h2 className="display text-6xl md:text-7xl"><span className="text-accent">Try it.</span></h2>
        <div className="chip-cream text-sm inline-flex">live demo</div>
        <p className="display text-xl font-mono break-all max-w-3xl">flowpay-onzaxx6ig-saalicks-projects.vercel.app</p>
        <div className="flex flex-wrap gap-3 justify-center">
          <Link href="/" className="pill-btn-orange">Open the app →</Link>
          <a href="https://github.com/saalick/flowpay-hackathon" target="_blank" rel="noreferrer" className="pill-btn-ghost">GitHub ↗</a>
          <a href="https://testnet.snowtrace.io/address/0xF8e02b6BC5551667907Ec3311611435c2E33a276" target="_blank" rel="noreferrer" className="pill-btn-mint">Snowtrace ↗</a>
        </div>
      </div>
    ),
  },
];

export default function Deck() {
  const [i, setI] = useState(0);
  const n = slides.length;

  const next = useCallback(() => setI((x) => Math.min(x + 1, n - 1)), [n]);
  const prev = useCallback(() => setI((x) => Math.max(x - 1, 0)), []);

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight" || e.key === " " || e.key === "PageDown") { e.preventDefault(); next(); }
      if (e.key === "ArrowLeft" || e.key === "PageUp") { e.preventDefault(); prev(); }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [next, prev]);

  const s = slides[i];

  return (
    <div className="fixed inset-0 bg-bg text-fg flex flex-col overflow-hidden">
      <span className="absolute top-16 right-20 text-5xl text-accent/50 rotate-12">✦</span>
      <span className="absolute bottom-24 left-20 text-4xl text-pinkNeon/50 -rotate-12">✦</span>
      <span className="absolute top-1/2 right-1/3 text-3xl text-cyan/40 rotate-6">✧</span>

      <div className="flex items-center justify-between px-8 py-5">
        <Link href="/" className="display text-xl flex items-center gap-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="https://i.ibb.co/wZfcp6DG/Neon-F-Flow-Emblem.png" alt="FlowPay" className="w-9 h-9 rounded-full border-2 border-ink shadow-brutal bg-bg" />
          FlowPay
        </Link>
        <span className="chip">slide {i + 1} / {n}</span>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center gap-8 px-10 animate-slide-up" key={i}>
        {s.title}
        {s.body}
      </div>

      <div className="flex items-center justify-between px-8 py-5">
        <button className="pill-btn-ghost text-sm py-2 px-4" onClick={prev} disabled={i === 0}>← prev</button>
        <div className="flex gap-1">
          {slides.map((_, j) => (
            <button key={j} className={`w-2 h-2 rounded-full border border-ink ${j === i ? "bg-accent" : "bg-panel"}`} onClick={() => setI(j)} />
          ))}
        </div>
        <button className="pill-btn-orange text-sm py-2 px-4" onClick={next} disabled={i === n - 1}>next →</button>
      </div>
    </div>
  );
}
