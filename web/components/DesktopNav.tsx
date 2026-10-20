"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { AccountBadge } from "./AccountBadge";

const consumer = [
  { href: "/home", label: "Home" },
  { href: "/pay", label: "Pay" },
  { href: "/deposit", label: "Deposit" },
];
const dev = [
  { href: "/admin", label: "Admin" },
  { href: "/lp", label: "LP" },
  { href: "/merchant", label: "Merchant" },
];

export function DesktopNav() {
  const path = usePathname() ?? "";
  if (path === "/") return null;
  return (
    <div className="topbar">
      <Link href="/home" className="display text-2xl flex items-center gap-3">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="https://i.ibb.co/wZfcp6DG/Neon-F-Flow-Emblem.png"
          alt="FlowPay"
          className="w-10 h-10 rounded-full border-2 border-ink shadow-brutal object-cover bg-bg"
        />
        <span>FlowPay</span>
        <span className="chip-mint ml-2 text-[10px]">Base · testnet</span>
      </Link>
      <nav className="topbar-nav">
        {consumer.map((t) => (
          <Link key={t.href} href={t.href} className={`topbar-link ${path.startsWith(t.href) ? "topbar-link-active" : ""}`}>
            {t.label}
          </Link>
        ))}
        <span className="w-px h-5 bg-ink/20 mx-1" />
        {dev.map((t) => (
          <Link key={t.href} href={t.href} className={`topbar-link ${path.startsWith(t.href) ? "topbar-link-active" : ""}`}>
            {t.label}
          </Link>
        ))}
      </nav>
      <AccountBadge />
    </div>
  );
}
