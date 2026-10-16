// Merchant endpoints are button-driven only (no voice):
//   POST /merchant/confirm → calls confirmReceived
//   POST /merchant/dispute → calls dispute("not received")
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { walletClient, serverAccount, explorerTx } from "../chain.js";
import { settlementAbi } from "../abis.js";
import { requireDeployment } from "../deployments.js";

const ConfirmBody = z.object({ orderId: z.string().regex(/^0x[0-9a-fA-F]{64}$/) });
const DisputeBody = z.object({
  orderId: z.string().regex(/^0x[0-9a-fA-F]{64}$/),
  reason: z.string().min(1).max(500).default("merchant: not received"),
});

export async function merchantRoutes(app: FastifyInstance) {
  app.post("/merchant/confirm", async (req, reply) => {
    const parsed = ConfirmBody.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    const dep = requireDeployment();
    try {
      const txHash = await walletClient.writeContract({
        account: serverAccount, chain: walletClient.chain,
        address: dep.settlement, abi: settlementAbi,
        functionName: "confirmReceived",
        args: [parsed.data.orderId as `0x${string}`],
      });
      return { ok: true, txHash, explorer: explorerTx(txHash) };
    } catch (err) {
      return reply.code(500).send({ error: String(err) });
    }
  });

  app.post("/merchant/dispute", async (req, reply) => {
    const parsed = DisputeBody.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    const dep = requireDeployment();
    try {
      const txHash = await walletClient.writeContract({
        account: serverAccount, chain: walletClient.chain,
        address: dep.settlement, abi: settlementAbi,
        functionName: "dispute",
        args: [parsed.data.orderId as `0x${string}`, parsed.data.reason],
      });
      return { ok: true, txHash, explorer: explorerTx(txHash) };
    } catch (err) {
      return reply.code(500).send({ error: String(err) });
    }
  });
}
