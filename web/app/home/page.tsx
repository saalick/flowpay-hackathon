"use client";
import { useEffect, useMemo, useState, useCallback } from "react";
import Link from "next/link";
import { useAccount, usePublicClient, useWalletClient, useChainId, useSwitchChain } from "wagmi";
import type { Address, Hex } from "viem";
import { api, type Deployment, type Order } from "@/lib/api";
import { erc20Abi, tripFactoryAbi } from "@/lib/abis";
import { CHAIN_ID, explorerAddr } from "@/lib/wagmi";
import { useWs } from "@/lib/ws";
import { Shell, TopBar } from "@/components/PhoneShell";
import { useToast } from "@/components/Toast";

const SALT = ("0x" + "11".repeat(32)) as Hex;

const tripAccountAbi = [
  { type: "function", name: "tripBudget", stateMutability: "view", inputs: [], outputs: [{ name: "", type: "uint256" }] },
  { type: "function", name: "spent", stateMutability: "view", inputs: [], outputs: [{ name: "", type: "uint256" }] },
  { type: "function", name: "remainingBudget", stateMutability: "view", inputs: [], outputs: [{ name: "", type: "uint256" }] },
  { type: "function", name: "perTxCap", stateMutability: "view", inputs: [], outputs: [{ name: "", type: "uint256" }] },
  { type: "function", name: "expiresAt", stateMutability: "view", inputs: [], outputs: [{ name: "", type: "uint64" }] },
] as const;

export default function Home() {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const { switchChain } = useSwitchChain();
  const publicClient = usePublicClient();
  const { data: walletClient } = useWalletClient();

  const [dep, setDep] = useState<Deployment | null>(null);
  const [fx, setFx] = useState<{ usdThb: number } | null>(null);
  const [tripAddr, setTripAddr] = useState<Address | null>(null);
  const [tripExists, setTripExists] = useState(false);
  const [tripBal, setTripBal] = useState<bigint>(0n);
  const [walletBal, setWalletBal] = useState<bigint>(0n);
  const [tripBudget, setTripBudget] = useState<bigint>(0n);
  const [tripSpent, setTripSpent] = useState<bigint>(0n);
  const [tripPerTx, setTripPerTx] = useState<bigint>(0n);
  const [tripExpires, setTripExpires] = useState<bigint>(0n);
  const [orders, setOrders] = useState<Order[]>([]);
  const [busy, setBusy] = useState<null | string>(null);
  const [autoTried, setAutoTried] = useState(false);
  const toast = useToast();

  useEffect(() => {
    api.deployment().then(setDep).catch(() => void 0);
    api.fx().then(setFx).catch(() => void 0);
  }, []);

  useEffect(() => {
    if (address) {
      api.predictTrip(address, SALT).then((r) => setTripAddr(r.account as Address));
    }
  }, [address]);

  const refresh = useCallback(async () => {
    if (!address || !publicClient || !dep) return;

    // Each read runs independently so one failure doesn't drop the rest.
    publicClient.readContract({
      address: dep.usdc, abi: erc20Abi, functionName: "balanceOf", args: [address],
    }).then((v) => setWalletBal(v as bigint)).catch(() => void 0);

    if (tripAddr) {
      // Trust on-chain `getCode` as the source of truth for tripExists —
      // avoids depending on the server's 8-call /trip/:address endpoint.
      publicClient.getCode({ address: tripAddr }).then((code) => {
        const exists = !!code && code.length > 2;
        setTripExists(exists);
        if (!exists) {
          setTripBal(0n); setTripBudget(0n); setTripSpent(0n); setTripPerTx(0n); setTripExpires(0n);
          return;
        }
        publicClient.readContract({ address: dep.usdc, abi: erc20Abi, functionName: "balanceOf", args: [tripAddr] })
          .then((v) => setTripBal(v as bigint)).catch(() => void 0);
        publicClient.readContract({ address: tripAddr, abi: tripAccountAbi, functionName: "tripBudget" })
          .then((v) => setTripBudget(v as bigint)).catch(() => void 0);
        publicClient.readContract({ address: tripAddr, abi: tripAccountAbi, functionName: "spent" })
          .then((v) => setTripSpent(v as bigint)).catch(() => void 0);
        publicClient.readContract({ address: tripAddr, abi: tripAccountAbi, functionName: "perTxCap" })
          .then((v) => setTripPerTx(v as bigint)).catch(() => void 0);
        publicClient.readContract({ address: tripAddr, abi: tripAccountAbi, functionName: "expiresAt" })
          .then((v) => setTripExpires(v as bigint)).catch(() => void 0);
      }).catch(() => void 0);
    }

    api.orders({ payer: tripAddr ?? address, limit: 10 })
      .then((r) => setOrders(r.orders))
      .catch(() => void 0);
  }, [address, publicClient, dep, tripAddr]);

  useEffect(() => { void refresh(); }, [refresh]);
  useWs((ev) => {
    const t = ev.type?.toString() ?? "";
    if (t.startsWith("order.") || t === "trip.created") void refresh();
  });

  const needsChain = isConnected && chainId !== CHAIN_ID;

  async function setupAccount() {
    if (!address || !publicClient) {
      toast.push({ kind: "bad", title: "Connect your wallet first" });
      return;
    }
    setBusy("Setting up your FlowPay account…");
    let account: string | null = null;
    try {
      const r = await api.createTrip({
        owner: address,
        tripBudget: "200000000",
        perTxCap: "50000000",
        expiresAt: Math.floor(Date.now() / 1000) + 7 * 24 * 3600,
        salt: SALT,
      });
      account = r.account;
      toast.push({ kind: "info", title: "Account deploying…", sub: r.txHash });
      // Wait up to ~15s for the clone to have bytecode onchain.
      for (let i = 0; i < 10; i++) {
        await new Promise((rs) => setTimeout(rs, 1500));
        try {
          const code = await publicClient.getCode({ address: r.account as Address });
          if (code && code.length > 2) break;
        } catch { /* ignore */ }
      }
    } catch (e) {
      toast.push({ kind: "bad", title: "Setup failed", sub: (e as Error).message });
      setBusy(null);
      return;
    }

    // Auto-fund with 10 MockUSDC so judges can immediately pay.
    setBusy("Funding with 10 MockUSDC…");
    try {
      if (account) {
        const f = await api.faucet(account);
        toast.push({ kind: "info", title: "Faucet tx submitted", sub: f.txHash });
        for (let i = 0; i < 10; i++) {
          await new Promise((rs) => setTimeout(rs, 1500));
          try {
            const bal = await publicClient.readContract({
              address: dep!.usdc, abi: erc20Abi, functionName: "balanceOf",
              args: [account as Address],
            });
            if ((bal as bigint) > 0n) break;
          } catch { /* ignore */ }
        }
        toast.push({ kind: "good", title: "Ready to pay · +10 USDC" });
      }
    } catch (e) {
      toast.push({ kind: "bad", title: "Auto-fund failed", sub: (e as Error).message });
    } finally {
      setBusy(null);
      await refresh();
    }
  }

  // Auto-deploy on first connect so users never see the "deploy" step.
  // We only need `address` — the server does predict + deploy; we don't need
  // our own predicted address first.
  useEffect(() => {
    if (!isConnected || !address || tripExists || busy || autoTried) return;
    setAutoTried(true);
    void setupAccount();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isConnected, address, tripExists, dep]);

  async function fund(usdcInt: bigint) {
    if (!walletClient || !dep || !tripAddr || !publicClient) return;
    setBusy("Funding account…");
    try {
      const hash = await walletClient.writeContract({
        address: dep.usdc,
        abi: erc20Abi,
        functionName: "transfer",
        type: "legacy",
        gas: 150_000n,
        gasPrice: 30_000_000_000n,
        args: [tripAddr, usdcInt],
      });
      toast.push({ kind: "info", title: "Transfer tx submitted", sub: hash });
      await publicClient.waitForTransactionReceipt({ hash });
      toast.push({ kind: "good", title: "Trip account funded" });
      await refresh();
    } catch (e) {
      toast.push({ kind: "bad", title: "Fund failed", sub: (e as Error).message });
    } finally {
      setBusy(null);
    }
  }

  const balanceUsd = useMemo(() => Number(tripBal) / 1e6, [tripBal]);
  const balanceLocal = useMemo(() => (fx ? balanceUsd * fx.usdThb : 0), [fx, balanceUsd]);
  const walletUsd = useMemo(() => Number(walletBal) / 1e6, [walletBal]);

  if (!isConnected) {
    return (
      <Shell>
        <TopBar title={<span>FlowPay</span>} />
        <div className="card space-y-3 text-center">
          <h2 className="display text-xl">Connect your wallet</h2>
          <p className="text-sm text-inkMuted">Avalanche Base Sepolia testnet — no real money.</p>
          <Link href="/" className="pill-btn-orange w-full">Go to login →</Link>
        </div>
      </Shell>
    );
  }

  return (
    <Shell>
      <TopBar
        left={<span className="display text-2xl">Meh! <span className="text-inkMuted font-normal text-base">{address?.slice(0,5)}…{address?.slice(-4)}</span></span>}
        right={
          <>
            <Link href="/deposit" className="icon-btn bg-forest text-cream" aria-label="Deposit">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3v12M7 10l5 5 5-5M4 21h16"/></svg>
            </Link>
            <Link href="/dash" className="icon-btn bg-orange text-ink" aria-label="Dev dashboard">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 01-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09a1.65 1.65 0 00-1-1.51 1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09a1.65 1.65 0 001.51-1 1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/></svg>
            </Link>
          </>
        }
      />

      {needsChain && (
        <div className="card-orange text-ink flex items-center justify-between">
          <span className="text-sm font-bold">Wrong network — switch to Base Sepolia.</span>
          <button className="pill-btn-dark text-sm py-2 px-4" onClick={() => switchChain({ chainId: CHAIN_ID })}>Switch</button>
        </div>
      )}

      <section className="card-forest space-y-4">
        <div className="flex items-center gap-2">
          <span className="chip bg-forest text-cream border-cream/40">Sell Rate: ₱{fx ? fx.usdThb.toFixed(2) : "—"}</span>
        </div>
        <div>
          <div className="text-cream/70 text-xs uppercase font-bold tracking-wider">USDC balance</div>
          <div className="display text-6xl mt-1 leading-none">
            {Math.floor(balanceUsd).toString()}
            <span className="text-cream/60 text-3xl align-top">.{String(Math.round((balanceUsd % 1) * 100)).padStart(2,"0")}</span>
          </div>
          <div className="text-cream/70 mt-1 text-sm">≈ ₱{balanceLocal.toFixed(2)}</div>
        </div>
        <div className="grid grid-cols-2 gap-3 pt-1">
          <Link href="/deposit" className="pill-btn-purple w-full">↙ Deposit</Link>
          <Link href="/pay" className="pill-btn-orange w-full">⚡ Pay</Link>
        </div>
      </section>

      {!tripExists && (
        <section className="card space-y-3">
          <div className="display text-lg">Getting you ready…</div>
          <p className="text-sm text-muted">
            Deploying your anonymous FlowPay account on Base Sepolia and dropping 10 MockUSDC in for the demo. Gas is on us.
          </p>
          {busy && <div className="text-xs text-cyan font-mono">{busy}</div>}
          <button
            className="pill-btn-orange w-full"
            disabled={!!busy}
            onClick={() => { setAutoTried(true); setupAccount(); }}
          >
            {busy ? "Working…" : "Set up & fund"}
          </button>
          {tripAddr && (
            <div className="text-[10px] text-muted font-mono break-all">
              Predicted address: {tripAddr}
            </div>
          )}
        </section>
      )}

      {tripExists && balanceUsd < 1 && (
        <section className="card space-y-3">
          <div className="display text-lg">Fund your FlowPay account</div>
          <p className="text-sm text-muted">
            Need test funds? Tap the faucet — we mint 10 MockUSDC straight into your account. Or move your own USDC from your wallet.
          </p>
          <button
            className="pill-btn-mint w-full"
            disabled={!!busy || !tripAddr}
            onClick={async () => {
              if (!tripAddr) return;
              setBusy("Minting 10 MockUSDC…");
              try {
                const r = await api.faucet(tripAddr);
                toast.push({ kind: "info", title: "Faucet tx submitted", sub: r.txHash });
                for (let i = 0; i < 20; i++) {
                  await new Promise((rs) => setTimeout(rs, 1500));
                  await refresh();
                  if (Number(tripBal) > 0) break;
                }
                toast.push({ kind: "good", title: "10 MockUSDC minted" });
              } catch (e) {
                toast.push({ kind: "bad", title: "Faucet failed", sub: (e as Error).message });
              } finally {
                setBusy(null);
              }
            }}
          >
            🚰 Get 10 test USDC
          </button>
          {walletUsd > 0 && (
            <>
              <div className="text-xs text-muted">Or move from your wallet (balance: {walletUsd.toFixed(4)} USDC):</div>
              <div className="flex gap-2 flex-wrap">
                <button className="pill-btn-ghost" disabled={!!busy || walletUsd < 1} onClick={() => fund(1_000_000n)}>+ 1 USDC</button>
                <button className="pill-btn-ghost" disabled={!!busy || walletUsd < 5} onClick={() => fund(5_000_000n)}>+ 5 USDC</button>
                <button className="pill-btn-ghost" disabled={!!busy || walletUsd < 25} onClick={() => fund(25_000_000n)}>+ 25 USDC</button>
              </div>
            </>
          )}
        </section>
      )}

      {tripExists && (
        <section className="card-mint space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs uppercase font-bold tracking-wider text-ink/70">Account budget · onchain</div>
              <div className="display text-3xl mt-1 leading-none">
                {(Number(tripBudget - tripSpent) / 1e6).toFixed(2)}
                <span className="text-ink/60 text-base"> / {(Number(tripBudget) / 1e6).toFixed(0)} USDC</span>
              </div>
              <div className="text-xs text-ink/70 mt-1">
                Per-tx cap {(Number(tripPerTx) / 1e6).toFixed(0)} USDC · expires {tripExpires > 0n ? new Date(Number(tripExpires) * 1000).toLocaleDateString() : "—"}
              </div>
            </div>
          </div>
          <div className="h-2 rounded-full bg-ink/15 overflow-hidden border border-ink/40">
            <div
              className="h-full bg-ink"
              style={{
                width: tripBudget > 0n ? `${Math.min(100, Number((tripSpent * 100n) / tripBudget))}%` : "0%",
              }}
            />
          </div>
          <div className="text-[10px] text-ink/60">
            Enforced in <code>TripAccount._checkLimits</code> — budget / per-tx cap / expiry all revert onchain.
          </div>
        </section>
      )}

      {orders.length > 0 && (
        <section className="space-y-2">
          <div className="display text-base px-1">Recent</div>
          {orders.slice(0, 3).map((o) => (
            <Link key={o.id} href={`/pay/${o.id}`} className="card flex items-center justify-between p-4">
              <div>
                <div className="display text-lg">₱{(Number(o.fiatAmount) / 100).toFixed(2)}</div>
                <div className="text-xs text-inkMuted">{(Number(o.usdcAmount) / 1e6).toFixed(4)} USDC · {o.status}{o.route ? ` · ${o.route}` : ""}</div>
              </div>
              <span className="icon-btn bg-cream">→</span>
            </Link>
          ))}
        </section>
      )}

      {tripAddr && (
        <p className="text-[10px] text-muted text-center font-mono break-all">
          account <a className="link" href={explorerAddr(tripAddr)} target="_blank" rel="noreferrer">{tripAddr}</a>
        </p>
      )}

      <div className="h-24" />

      <div className="fixed bottom-6 left-0 right-0 flex justify-center pointer-events-none z-20">
        <Link
          href="/pay"
          className={`pill-btn-dark text-base px-7 py-4 pointer-events-auto ${tripExists ? "pulse-ring" : ""}`}
          onClick={(e) => {
            if (!tripExists) {
              e.preventDefault();
              toast.push({ kind: "bad", title: "Account still setting up — one sec" });
            }
          }}
        >
          <span className="inline-flex items-center gap-2">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="3" height="3"/><rect x="18" y="14" width="3" height="3"/><rect x="14" y="18" width="3" height="3"/><rect x="18" y="18" width="3" height="3"/></svg>
            Scan &amp; Pay
          </span>
        </Link>
      </div>
    </Shell>
  );
}
