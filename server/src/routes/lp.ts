import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { db } from "../db.js";
import { publish } from "../events.js";
import { publicClient } from "../chain.js";
import { lpRegistryAbi } from "../abis.js";
import { requireDeployment } from "../deployments.js";

const AnnounceBody = z.object({
  address: z.string().regex(/^0x[0-9a-fA-F]{40}$/),
  displayName: z.string().min(1).max(60),
  rail: z.string().default("PROMPTPAY"),
  currency: z.string().default("THB"),
  online: z.boolean().default(true),
  autoAccept: z.boolean().default(false),
});

const UpdateBody = z.object({
  address: z.string().regex(/^0x[0-9a-fA-F]{40}$/),
  online: z.boolean().optional(),
  autoAccept: z.boolean().optional(),
});

export async function lpRoutes(app: FastifyInstance) {
  app.post("/lp/announce", async (req, reply) => {
    const parsed = AnnounceBody.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    const d = parsed.data;
    db.prepare(
      `INSERT INTO lps(address, display_name, rail, currency, online, auto_accept, created_at)
       VALUES(?,?,?,?,?,?,?)
       ON CONFLICT(address) DO UPDATE SET
         display_name=excluded.display_name, rail=excluded.rail, currency=excluded.currency,
         online=excluded.online, auto_accept=excluded.auto_accept`,
    ).run(d.address, d.displayName, d.rail, d.currency, d.online ? 1 : 0, d.autoAccept ? 1 : 0, Date.now());
    publish("lp.updated", d);
    return { ok: true };
  });

  app.post("/lp/update", async (req, reply) => {
    const parsed = UpdateBody.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    const d = parsed.data;
    if (d.online !== undefined) {
      db.prepare("UPDATE lps SET online = ? WHERE address = ?").run(d.online ? 1 : 0, d.address);
    }
    if (d.autoAccept !== undefined) {
      db.prepare("UPDATE lps SET auto_accept = ? WHERE address = ?").run(d.autoAccept ? 1 : 0, d.address);
    }
    publish("lp.updated", d);
    return { ok: true };
  });

  app.get("/lp/list", async () => db.prepare("SELECT * FROM lps").all());

  app.get("/lp/:address", async (req, reply) => {
    const { address } = req.params as { address: string };
    const row = db.prepare("SELECT * FROM lps WHERE address = ?").get(address);
    const dep = requireDeployment();
    const [total, locked, free, registered] = await Promise.all([
      publicClient.readContract({ address: dep.lpRegistry, abi: lpRegistryAbi, functionName: "totalStake", args: [address as `0x${string}`] }),
      publicClient.readContract({ address: dep.lpRegistry, abi: lpRegistryAbi, functionName: "lockedStake", args: [address as `0x${string}`] }),
      publicClient.readContract({ address: dep.lpRegistry, abi: lpRegistryAbi, functionName: "freeStake", args: [address as `0x${string}`] }),
      publicClient.readContract({ address: dep.lpRegistry, abi: lpRegistryAbi, functionName: "isRegistered", args: [address as `0x${string}`] }),
    ]);
    if (!row) return reply.code(404).send({ error: "unknown lp (announce first)" });
    return {
      ...row,
      stake: { total: String(total), locked: String(locked), free: String(free), registered },
    };
  });
}
