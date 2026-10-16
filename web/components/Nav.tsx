"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ConnectButton } from "./ConnectButton";

const tabs = [
  { href: "/trip", label: "Tourist" },
  { href: "/merchant", label: "Merchant" },
  { href: "/lp", label: "LP" },
  { href: "/admin", label: "Admin" },
];

export function Nav() {
  const pathname = usePathname();
  return (
    <header className="sticky top-0 z-10 bg-bg/80 backdrop-blur border-b border-line">
      <div className="max-w-6xl mx-auto px-4 py-3 flex items-center gap-4">
        <Link href="/" className="font-bold text-accent text-lg">FlowPay</Link>
        <span className="pill">Fuji · testnet</span>
        <nav className="flex-1 flex gap-1 justify-center">
          {tabs.map((t) => {
            const active = pathname?.startsWith(t.href);
            return (
              <Link
                key={t.href}
                href={t.href}
                className={`px-3 py-1.5 rounded-md text-sm ${
                  active ? "bg-line text-text" : "text-muted hover:text-text"
                }`}
              >
                {t.label}
              </Link>
            );
          })}
        </nav>
        <ConnectButton />
      </div>
    </header>
  );
}
