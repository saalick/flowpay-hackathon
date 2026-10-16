// Gasless pay: relayer submits payWithSig on behalf of the tourist, so the
// tourist never needs Fuji AVAX. The tourist's wallet signs an EIP-712 "Pay"
// message off-chain; the server submits it against their TripAccount.
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { walletClient, serverAccount, explorerTx } from "../chain.js";
import { tripAccountAbi } from "../abis.js";
import type { Address } from "viem";

const QuoteSchema = z.object({
  orderRef: z.string().regex(/^0x[0-9a-fA-F]{64}$/),
  merchantId: z.string().regex(/^0x[0-9a-fA-F]{64}$/),
  payer: z.string().regex(/^0x[0-9a-fA-F]{40}$/),
  fiatAmount: z.string(),
  currency: z.string().regex(/^0x[0-9a-fA-F]{6}$/),
  usdcAmount: z.string(),
  expiresAt: z.string(),
});

const Body = z.object({
  tripAccount: z.string().regex(/^0x[0-9a-fA-F]{40}$/),
  quote: QuoteSchema,
  quoteSig: z.string().regex(/^0x[0-9a-fA-F]+$/),
  deadline: z.number().int(),
  ownerSig: z.string().regex(/^0x[0-9a-fA-F]+$/),
});

export async function payRoutes(app: FastifyInstance) {
  app.post("/pay/gasless", async (req, reply) => {
    const parsed = Body.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    const d = parsed.data;
    try {
      const txHash = await walletClient.writeContract({
        account: serverAccount,
        chain: walletClient.chain,
        address: d.tripAccount as Address,
        abi: tripAccountAbi,
        functionName: "payWithSig",
        args: [
          {
            orderRef: d.quote.orderRef as `0x${string}`,
            merchantId: d.quote.merchantId as `0x${string}`,
            payer: d.quote.payer as Address,
            fiatAmount: BigInt(d.quote.fiatAmount),
            currency: d.quote.currency as `0x${string}`,
            usdcAmount: BigInt(d.quote.usdcAmount),
            expiresAt: BigInt(d.quote.expiresAt),
          },
          d.quoteSig as `0x${string}`,
          BigInt(d.deadline),
          d.ownerSig as `0x${string}`,
        ],
      });
      return { ok: true, txHash, explorer: explorerTx(txHash) };
    } catch (err) {
      return reply.code(500).send({ error: String(err) });
    }
  });
}
