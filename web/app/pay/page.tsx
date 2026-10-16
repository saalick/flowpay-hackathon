"use client";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useAccount, usePublicClient, useWalletClient } from "wagmi";
import type { Address, Hex } from "viem";
import { api, type Deployment, type QuoteResponse } from "@/lib/api";
import { tripAccountAbi, erc20Abi } from "@/lib/abis";
import { Shell, TopBar, BackButton } from "@/components/PhoneShell";
import { useToast } from "@/components/Toast";

const SALT = ("0x" + "11".repeat(32)) as Hex;

export default function PayScreen() {
  const router = useRouter();
  const { address, isConnected } = useAccount();
  const publicClient = usePublicClient();
  const { data: walletClient } = useWalletClient();
  const [dep, setDep] = useState<Deployment | null>(null);
  const [fx, setFx] = useState<{ usdThb: number } | null>(null);
  const [amountStr, setAmountStr] = useState("0");
  const [tripAddr, setTripAddr] = useState<Address | null>(null);
  const [tripBal, setTripBal] = useState<bigint>(0n);
  const [busy, setBusy] = useState<string | null>(null);
  const toast = useToast();

  useEffect(() => {
    api.deployment().then(setDep);
    api.fx().then(setFx);
  }, []);

  useEffect(() => {
    if (!address) return;
    api.predictTrip(address, SALT).then((r) => setTripAddr(r.account as Address));
  }, [address]);

  useEffect(() => {
    if (!publicClient || !dep || !tripAddr) return;
    publicClient
      .readContract({
        address: dep.usdc,
        abi: erc20Abi,
        functionName: "balanceOf",
        args: [tripAddr],
      })
      .then((v) => setTripBal(v as bigint))
      .catch(() => void 0);
  }, [publicClient, dep, tripAddr]);

  const amount = Number(amountStr) || 0;
  const usdcEst = useMemo(() => (fx ? amount / fx.usdThb : 0), [fx, amount]);

  function push(c: string) {
    setAmountStr((prev) => {
      if (c === "." && prev.includes(".")) return prev;
      if (prev === "0" && c !== ".") return c;
      if (prev.length >= 10) return prev;
      return prev + c;
    });
  }
  function back() { setAmountStr((p) => (p.length <= 1 ? "0" : p.slice(0, -1))); }
  function clear() { setAmountStr("0"); }
  function max() {
    if (!fx) return;
    const maxThb = Math.floor((Number(tripBal) / 1e6) * fx.usdThb);
    setAmountStr(String(Math.max(0, maxThb)));
  }

  async function place() {
    if (!dep || !address || !walletClient || !tripAddr || !publicClient) return;
    const fiatMinor = Math.round(amount * 100);
    if (fiatMinor <= 0) return;
    setBusy("Fetching quote…");
    try {
      // FlowSettlement.createOrder requires msg.sender == q.payer. msg.sender
      // is the TripAccount, so the quote must be signed with payer=tripAddr.
      const q: QuoteResponse = await api.quote({
        payer: tripAddr,
        fiatAmount: fiatMinor,
      });
      if (BigInt(q.quote.usdcAmount) > tripBal) {
        throw new Error("Insufficient balance in trip account");
      }
      setBusy("Confirm in your wallet…");
      const hash = await walletClient.writeContract({
        address: tripAddr,
        abi: tripAccountAbi,
        functionName: "pay",
        type: "legacy",
        gas: 600_000n,
        gasPrice: 30_000_000_000n,
        args: [
          {
            orderRef: q.quote.orderRef,
            merchantId: q.quote.merchantId,
            payer: q.quote.payer,
            fiatAmount: BigInt(q.quote.fiatAmount),
            currency: q.quote.currency,
            usdcAmount: BigInt(q.quote.usdcAmount),
            expiresAt: BigInt(q.quote.expiresAt),
          },
          q.signature,
        ],
      });
      setBusy("Submitting…");
      await api.recordOrder({
        orderId: q.orderId,
        orderRef: q.quote.orderRef,
        merchantId: q.quote.merchantId,
        payer: q.quote.payer,
        fiatAmount: Number(q.quote.fiatAmount),
        currency: "THB",
        usdcAmount: q.quote.usdcAmount,
        openUntil: Math.floor(Date.now() / 1000) + 10,
        txHash: hash,
      });
      toast.push({ kind: "good", title: "Payment sent", sub: "Watching the engine for route decision…" });
      router.push(`/pay/${q.orderId}`);
    } catch (e) {
      toast.push({ kind: "bad", title: "Payment failed", sub: (e as Error).message });
      setBusy(null);
    }
  }

  if (!isConnected) {
    return (
      <Shell>
        <TopBar left={<BackButton href="/" />} title="Scan & Pay" />
        <div className="card">Connect your wallet to pay.</div>
      </Shell>
    );
  }

  return (
    <Shell>
      <TopBar
        left={<BackButton href="/home" />}
        title="Scan & Pay"
        right={<span className="chip-mint">Help</span>}
      />

      <div className="card flex items-start gap-3">
        <span className="w-5 h-5 rounded-full border-2 border-ink bg-orange mt-1" />
        <div className="text-sm">
          Please ask the vendor for the <b>bill amount only</b>. Don't ask for a QR yet.
        </div>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center gap-3 py-6 text-center">
        <div className="text-sm text-muted font-display font-bold">You're paying</div>
        <div className="display text-7xl text-fg leading-none">
          <span className="text-fg/60 mr-1">฿</span>{amountStr === "0" ? "0" : amountStr}
        </div>
        <div className="chip-forest">↕ ≈ {usdcEst.toFixed(usdcEst < 1 ? 4 : 2)} USDC</div>
        <div className="text-xs text-muted">
          Trip balance: {(Number(tripBal) / 1e6).toFixed(4)} USDC
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        {["1","2","3","4","5","6","7","8","9",".","0","⌫"].map((k) => (
          <button
            key={k}
            className={`keypad-key ${k === "⌫" ? "bg-purple" : ""}`}
            onClick={() => (k === "⌫" ? back() : push(k))}
          >
            {k}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <button className="pill-btn-orange w-full" onClick={max}>Max</button>
        <button className="pill-btn-mint w-full" onClick={clear}>Clear</button>
      </div>

      <button
        className="pill-btn-dark w-full py-5 text-lg"
        disabled={!!busy || amount <= 0}
        onClick={place}
      >
        {busy ?? `Place Order  →`}
      </button>
    </Shell>
  );
}
