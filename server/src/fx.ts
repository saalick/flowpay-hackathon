import { env } from "./env.js";

export function phpCentToUsdc(fiatSatang: bigint): bigint {
  const usd = Number(fiatSatang) / 100 / env.FX_FALLBACK_USD_PHP;
  const withSpread = usd * (1 + env.QUOTE_SPREAD_BPS / 10_000);
  return BigInt(Math.round(withSpread * 1_000_000));
}

export function usdcToPhpMajor(usdcMicro: bigint): number {
  return (Number(usdcMicro) / 1_000_000) * env.FX_FALLBACK_USD_PHP;
}

export function fxInfo() {
  return {
    provider: "fallback-constant",
    currency: "PHP",
    usdThb: env.FX_FALLBACK_USD_PHP, // kept name for backwards-compat with existing web client; value is now PHP
    spreadBps: env.QUOTE_SPREAD_BPS,
    asOf: new Date().toISOString(),
  };
}
