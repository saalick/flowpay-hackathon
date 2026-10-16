import "dotenv/config";
import { z } from "zod";

const Schema = z.object({
  FUJI_RPC_URL: z.string().url().default("https://api.avax-test.network/ext/bc/C/rpc"),
  CHAIN_ID: z.coerce.number().default(43113),
  SERVER_PRIVATE_KEY: z.string().regex(/^0x[0-9a-fA-F]{64}$/),
  USDC_ADDRESS: z.string().regex(/^0x[0-9a-fA-F]{40}$/),
  MAX_OFFRAMP_FEE_BPS: z.coerce.number().default(150),
  MAX_OFFRAMP_ETA_SEC: z.coerce.number().default(60),
  OFFRAMP_ENABLED: z.coerce.boolean().default(true),
  OFFRAMP_FEE_BPS: z.coerce.number().default(100),
  OFFRAMP_ETA_SEC: z.coerce.number().default(30),
  FLOAT_SEED_THB: z.coerce.number().default(50_000),
  FLOAT_ENABLED: z.coerce.boolean().default(true),
  FX_FALLBACK_USD_THB: z.coerce.number().default(36.5),
  QUOTE_SPREAD_BPS: z.coerce.number().default(50),
  PORT: z.coerce.number().default(8787),
  PUBLIC_WEB_ORIGIN: z.string().default("http://localhost:3000"),
});

export const env = Schema.parse(process.env);
export type Env = typeof env;
