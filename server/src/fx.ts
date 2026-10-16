import { env } from "./env.js";

export function thbSatangToUsdc(fiatSatang: bigint): bigint {
  const usd = Number(fiatSatang) / 100 / env.FX_FALLBACK_USD_THB;
  const withSpread = usd * (1 + env.QUOTE_SPREAD_BPS / 10_000);
  return BigInt(Math.round(withSpread * 1_000_000));
}

export function usdcToThbMajor(usdcMicro: bigint): number {
  return (Number(usdcMicro) / 1_000_000) * env.FX_FALLBACK_USD_THB;
}

export function fxInfo() {
  return {
    provider: "fallback-constant",
    usdThb: env.FX_FALLBACK_USD_THB,
    spreadBps: env.QUOTE_SPREAD_BPS,
    asOf: new Date().toISOString(),
  };
}
