import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import type { Address } from "viem";

const here = dirname(fileURLToPath(import.meta.url));
const DEPLOY_PATH = join(here, "..", "..", "contracts", "deployments", "fuji.deployed.json");

export type Deployment = {
  chainId: number;
  usdc: Address;
  settlement: Address;
  lpRegistry: Address;
  tripFactory: Address;
  tripImplementation: Address;
  treasury: Address;
  demoMerchantId: `0x${string}`;
};

export function loadDeployment(): Deployment | null {
  if (!existsSync(DEPLOY_PATH)) return null;
  return JSON.parse(readFileSync(DEPLOY_PATH, "utf8")) as Deployment;
}

export function requireDeployment(): Deployment {
  const d = loadDeployment();
  if (!d) throw new Error("No deployment at " + DEPLOY_PATH);
  return d;
}
