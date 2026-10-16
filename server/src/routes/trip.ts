import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { walletClient, publicClient, serverAccount, explorerTx } from "../chain.js";
import { factoryAbi, tripAccountAbi } from "../abis.js";
import { requireDeployment } from "../deployments.js";
import { db } from "../db.js";
import { publish } from "../events.js";
import type { Address } from "viem";

const CreateBody = z.object({
  owner: z.string().regex(/^0x[0-9a-fA-F]{40}$/),
  tripBudget: z.string(),
  perTxCap: z.string(),
  expiresAt: z.number().int(),
  salt: z.string().regex(/^0x[0-9a-fA-F]{64}$/),
});

const GaslessBody = z.object({
  owner: z.string().regex(/^0x[0-9a-fA-F]{40}$/),
  tripBudget: z.string(),
  perTxCap: z.string(),
  expiresAt: z.number().int(),
  salt: z.string().regex(/^0x[0-9a-fA-F]{64}$/),
  deadline: z.number().int(),
  ownerSig: z.string(),
});

export async function tripRoutes(app: FastifyInstance) {
  app.get("/trip/predict", async (req) => {
    const q = req.query as { owner: string; salt: string };
    const dep = requireDeployment();
    const addr = await publicClient.readContract({
      address: dep.tripFactory, abi: factoryAbi, functionName: "predict",
      args: [q.owner as Address, q.salt as `0x${string}`],
    });
    return { account: addr };
  });

  app.get("/trip/:address", async (req, reply) => {
    const { address } = req.params as { address: string };
    try {
      const [owner, budget, spent, remaining, perTxCap, agent, agentCap, expiresAt] = await Promise.all([
        publicClient.readContract({ address: address as Address, abi: tripAccountAbi, functionName: "owner" }),
        publicClient.readContract({ address: address as Address, abi: tripAccountAbi, functionName: "tripBudget" }),
        publicClient.readContract({ address: address as Address, abi: tripAccountAbi, functionName: "spent" }),
        publicClient.readContract({ address: address as Address, abi: tripAccountAbi, functionName: "remainingBudget" }),
        publicClient.readContract({ address: address as Address, abi: tripAccountAbi, functionName: "perTxCap" }),
        publicClient.readContract({ address: address as Address, abi: tripAccountAbi, functionName: "agent" }),
        publicClient.readContract({ address: address as Address, abi: tripAccountAbi, functionName: "agentPerTxCap" }),
        publicClient.readContract({ address: address as Address, abi: tripAccountAbi, functionName: "expiresAt" }),
      ]);
      return {
        address, owner,
        tripBudget: String(budget), spent: String(spent), remainingBudget: String(remaining),
        perTxCap: String(perTxCap), agent, agentPerTxCap: String(agentCap),
        expiresAt: Number(expiresAt),
      };
    } catch {
      return reply.code(404).send({ error: "trip not deployed at that address" });
    }
  });

  app.post("/trip/create", async (req, reply) => {
    const parsed = CreateBody.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    const d = parsed.data;
    const dep = requireDeployment();
    try {
      const txHash = await walletClient.writeContract({
        account: serverAccount, chain: walletClient.chain,
        address: dep.tripFactory, abi: factoryAbi, functionName: "createTrip",
        args: [
          d.owner as Address, BigInt(d.tripBudget), BigInt(d.perTxCap),
          BigInt(d.expiresAt), d.salt as `0x${string}`,
        ],
      });
      const predicted = await publicClient.readContract({
        address: dep.tripFactory, abi: factoryAbi, functionName: "predict",
        args: [d.owner as Address, d.salt as `0x${string}`],
      });
      db.prepare(
        "INSERT INTO trips(address, owner, trip_budget, per_tx_cap, expires_at, created_at) VALUES(?,?,?,?,?,?) ON CONFLICT(address) DO NOTHING",
      ).run(predicted, d.owner, d.tripBudget, d.perTxCap, d.expiresAt, Date.now());
      publish("trip.created", { owner: d.owner, account: predicted, txHash });
      return { ok: true, account: predicted, txHash, explorer: explorerTx(txHash) };
    } catch (err) {
      return reply.code(500).send({ error: String(err) });
    }
  });

  app.post("/trip/create-gasless", async (req, reply) => {
    const parsed = GaslessBody.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    const d = parsed.data;
    const dep = requireDeployment();
    try {
      const txHash = await walletClient.writeContract({
        account: serverAccount, chain: walletClient.chain,
        address: dep.tripFactory, abi: factoryAbi, functionName: "createTripWithSig",
        args: [
          d.owner as Address, BigInt(d.tripBudget), BigInt(d.perTxCap),
          BigInt(d.expiresAt), d.salt as `0x${string}`,
          BigInt(d.deadline), d.ownerSig as `0x${string}`,
        ],
      });
      const predicted = await publicClient.readContract({
        address: dep.tripFactory, abi: factoryAbi, functionName: "predict",
        args: [d.owner as Address, d.salt as `0x${string}`],
      });
      publish("trip.created", { owner: d.owner, account: predicted, txHash, gasless: true });
      return { ok: true, account: predicted, txHash, explorer: explorerTx(txHash) };
    } catch (err) {
      return reply.code(500).send({ error: String(err) });
    }
  });
}
