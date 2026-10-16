import Database from "better-sqlite3";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const DB_PATH = join(here, "..", "flowpay.db");

export const db = new Database(DB_PATH);
db.pragma("journal_mode = WAL");

db.exec(`
CREATE TABLE IF NOT EXISTS orders (
  order_id TEXT PRIMARY KEY,
  order_ref TEXT NOT NULL,
  merchant_id TEXT NOT NULL,
  payer TEXT NOT NULL,
  fiat_amount INTEGER NOT NULL,
  currency TEXT NOT NULL,
  usdc_amount TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open',
  route TEXT,
  assigned_lp TEXT,
  payment_ref TEXT,
  net_amount TEXT,
  fee TEXT,
  created_at INTEGER NOT NULL,
  open_until INTEGER NOT NULL,
  pay_deadline INTEGER,
  settled_at INTEGER,
  tx_create TEXT,
  tx_accept TEXT,
  tx_mark_paid TEXT,
  tx_route TEXT,
  tx_settle TEXT,
  updated_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS orders_payer_idx ON orders(payer);
CREATE INDEX IF NOT EXISTS orders_merchant_idx ON orders(merchant_id);
CREATE INDEX IF NOT EXISTS orders_status_idx ON orders(status);

CREATE TABLE IF NOT EXISTS merchants (
  merchant_id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  address TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS lps (
  address TEXT PRIMARY KEY,
  display_name TEXT NOT NULL,
  rail TEXT NOT NULL,
  currency TEXT NOT NULL,
  online INTEGER NOT NULL DEFAULT 1,
  auto_accept INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS trips (
  address TEXT PRIMARY KEY,
  owner TEXT NOT NULL,
  trip_budget TEXT NOT NULL,
  per_tx_cap TEXT NOT NULL,
  expires_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS admin_flags (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS float_ledger (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id TEXT NOT NULL,
  currency TEXT NOT NULL,
  amount INTEGER NOT NULL,
  payment_ref TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
`);

const seed = db.prepare("INSERT INTO admin_flags(key, value) VALUES(?,?) ON CONFLICT(key) DO NOTHING");
seed.run("offramp.enabled", "true");
seed.run("offramp.feeBps", "100");
seed.run("offramp.etaSec", "30");
seed.run("float.enabled", "true");
seed.run("float.balanceTHB", "50000");
seed.run("maxOfframpFeeBps", "150");
seed.run("maxOfframpEtaSec", "60");

export function getFlag(key: string): string | undefined {
  const row = db.prepare("SELECT value FROM admin_flags WHERE key = ?").get(key) as { value?: string } | undefined;
  return row?.value;
}
export function setFlag(key: string, value: string) {
  db.prepare("INSERT INTO admin_flags(key, value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value").run(key, value);
}
export function listFlags(): Record<string, string> {
  const rows = db.prepare("SELECT key, value FROM admin_flags").all() as { key: string; value: string }[];
  return Object.fromEntries(rows.map((r) => [r.key, r.value]));
}
