"use client";
import { useEffect, useRef } from "react";

const URL = process.env.NEXT_PUBLIC_WS_URL ?? "ws://localhost:8787/ws";

export type WsEvent = { type: string; [k: string]: unknown };

export function useWs(onEvent: (ev: WsEvent) => void) {
  const ref = useRef<WebSocket | null>(null);
  const handlerRef = useRef(onEvent);
  handlerRef.current = onEvent;

  useEffect(() => {
    let dead = false;
    let backoff = 500;

    const connect = () => {
      if (dead) return;
      const ws = new WebSocket(URL);
      ref.current = ws;
      ws.onopen = () => { backoff = 500; };
      ws.onmessage = (e) => {
        try {
          handlerRef.current(JSON.parse(e.data));
        } catch { /* noop */ }
      };
      ws.onclose = () => {
        if (dead) return;
        setTimeout(connect, backoff);
        backoff = Math.min(backoff * 2, 10_000);
      };
      ws.onerror = () => { try { ws.close(); } catch { /* noop */ } };
    };

    connect();
    return () => {
      dead = true;
      try { ref.current?.close(); } catch { /* noop */ }
    };
  }, []);
}
