import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { listFlags, setFlag } from "../db.js";
import { publish } from "../events.js";
import { requireDeployment } from "../deployments.js";
import { explorerAddr, explorerTx, walletClient, serverAccount } from "../chain.js";

const FlagBody = z.object({ key: z.string(), value: z.string() });
const FaucetBody = z.object({
  to: z.string().regex(/^0x[0-9a-fA-F]{40}$/),
  amount: z.string().optional(),
});
const MOCK_USDC_MINT_ABI = [
  { type: "function", name: "mint", stateMutability: "nonpayable", inputs: [{ name: "to", type: "address" }, { name: "amount", type: "uint256" }], outputs: [] },
] as const;

export async function adminRoutes(app: FastifyInstance) {
  app.get("/admin/flags", async () => ({ flags: listFlags() }));

  app.post("/admin/flag", async (req, reply) => {
    const parsed = FlagBody.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    setFlag(parsed.data.key, parsed.data.value);
    publish("admin.flag", parsed.data);
    return { ok: true, flags: listFlags() };
  });

  app.post("/faucet", async (req, reply) => {
    const parsed = FaucetBody.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    const dep = requireDeployment();
    const amount = BigInt(parsed.data.amount ?? "10000000"); // 10 USDC (6 decimals)
    try {
      const txHash = await walletClient.writeContract({
        account: serverAccount, chain: walletClient.chain,
        address: dep.usdc, abi: MOCK_USDC_MINT_ABI,
        functionName: "mint",
        args: [parsed.data.to as `0x${string}`, amount],
      });
      publish("admin.flag", { key: "faucet.minted", value: `${parsed.data.to}:${amount.toString()}` });
      return { ok: true, txHash, explorer: explorerTx(txHash), amount: amount.toString() };
    } catch (err) {
      return reply.code(500).send({ error: String(err) });
    }
  });

  app.get("/deployment", async () => {
    const d = requireDeployment();
    return {
      ...d,
      explorer: {
        settlement: explorerAddr(d.settlement),
        lpRegistry: explorerAddr(d.lpRegistry),
        tripFactory: explorerAddr(d.tripFactory),
        treasury: explorerAddr(d.treasury),
        usdc: explorerAddr(d.usdc),
      },
    };
  });
}
