"use client";
import { createContext, useContext, useState, useCallback, type ReactNode } from "react";

type Toast = { id: number; kind: "info" | "good" | "bad"; title: string; sub?: string };
type Ctx = { push: (t: Omit<Toast, "id">) => void };

const C = createContext<Ctx | null>(null);

export function useToast() {
  const c = useContext(C);
  if (!c) throw new Error("ToastProvider missing");
  return c;
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<Toast[]>([]);
  const push = useCallback((t: Omit<Toast, "id">) => {
    const id = Date.now() + Math.random();
    setItems((prev) => [...prev, { ...t, id }]);
    setTimeout(() => setItems((prev) => prev.filter((x) => x.id !== id)), 4800);
  }, []);
  return (
    <C.Provider value={{ push }}>
      {children}
      <div className="toast-wrap">
        {items.map((t) => (
          <div key={t.id} className={`toast ${t.kind === "good" ? "toast-good" : t.kind === "bad" ? "toast-bad" : ""}`}>
            <span className="text-2xl leading-none">
              {t.kind === "good" ? "✓" : t.kind === "bad" ? "!" : "ℹ"}
            </span>
            <div className="flex-1">
              <div className="display text-base leading-tight">{t.title}</div>
              {t.sub && <div className="text-xs opacity-80 mt-0.5 break-words">{t.sub}</div>}
            </div>
          </div>
        ))}
      </div>
    </C.Provider>
  );
}
