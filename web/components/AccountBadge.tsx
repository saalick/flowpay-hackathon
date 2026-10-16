"use client";
import { useAccount, useConnect, useDisconnect } from "wagmi";

export function AccountBadge() {
  const { address, isConnected } = useAccount();
  const { connectors, connect, isPending } = useConnect();
  const { disconnect } = useDisconnect();

  if (isConnected && address) {
    return (
      <button
        className="chip-orange active:translate-x-[2px] active:translate-y-[2px] active:shadow-none transition"
        onClick={() => disconnect()}
        title="Disconnect"
      >
        <span className="w-2 h-2 rounded-full bg-ink" />
        {address.slice(0, 5)}…{address.slice(-4)}
      </button>
    );
  }
  const inj = connectors[0];
  return (
    <button
      className="pill-btn-dark text-sm py-2 px-4"
      disabled={!inj || isPending}
      onClick={() => inj && connect({ connector: inj }, { onError: (err) => { if (!/reject/i.test(err.message)) alert(err.message); } })}
    >
      {isPending ? "…" : "Connect"}
    </button>
  );
}
