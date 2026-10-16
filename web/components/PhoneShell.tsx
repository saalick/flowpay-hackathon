"use client";
import { useRouter } from "next/navigation";
import { type ReactNode } from "react";

export function BackButton({ href }: { href?: string }) {
  const router = useRouter();
  return (
    <button
      className="icon-btn bg-cream"
      aria-label="Back"
      onClick={() => (href ? router.push(href) : router.back())}
    >
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M19 12H5M12 19l-7-7 7-7" />
      </svg>
    </button>
  );
}

export function TopBar({
  left,
  title,
  right,
}: {
  left?: ReactNode;
  title?: ReactNode;
  right?: ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="flex items-center gap-3">
        {left}
        {title && <h1 className="display text-xl">{title}</h1>}
      </div>
      <div className="flex items-center gap-2">{right}</div>
    </div>
  );
}

export function Shell({ children }: { children: ReactNode }) {
  return <div className="shell">{children}</div>;
}
