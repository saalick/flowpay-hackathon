import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { requireDeployment } from "../deployments.js";
import { env } from "../env.js";
import { phpCentToUsdc, fxInfo } from "../fx.js";
import {
  deriveOrderId, merchantIdFromHandle, newOrderRef,
  signQuoteForSettlement, phpCurrencyBytes3, type Quote,
} from "../signing.js";

const Body = z.object({
  merchantHandle: z.string().min(1),
  fiatAmount: z.number().int().positive(),   // satang
  currency: z.literal("PHP"),
  payer: z.string().regex(/^0x[0-9a-fA-F]{40}$/),
});

export async function quoteRoutes(app: FastifyInstance) {
  app.get("/fx", async () => fxInfo());

  app.post("/quote", async (req, reply) => {
    const parsed = Body.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    const { merchantHandle, fiatAmount, payer } = parsed.data;

    const dep = requireDeployment();
    const merchantId = merchantIdFromHandle(merchantHandle);
    const orderRef = newOrderRef();
    const usdcAmount = phpCentToUsdc(BigInt(fiatAmount));
    const expiresAt = BigInt(Math.floor(Date.now() / 1000) + 300);

    const q: Quote = {
      orderRef, merchantId,
      payer: payer as `0x${string}`,
      fiatAmount: BigInt(fiatAmount),
      currency: phpCurrencyBytes3(),
      usdcAmount, expiresAt,
    };
    const sig = await signQuoteForSettlement(q, dep.settlement, dep.chainId);
    const orderId = deriveOrderId(orderRef, dep.chainId, dep.settlement);

    return {
      quote: {
        orderRef, merchantId, payer,
        fiatAmount: String(fiatAmount),
        currency: q.currency,
        usdcAmount: String(usdcAmount),
        expiresAt: String(expiresAt),
      },
      signature: sig,
      orderId,
      display: {
        fiatMajor: fiatAmount / 100,
        usdcMajor: Number(usdcAmount) / 1_000_000,
        fxUsdThb: env.FX_FALLBACK_USD_PHP,
      },
    };
  });
}
