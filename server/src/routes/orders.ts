import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { getOrder, listOrders, recordOrder } from "../orchestrator.js";

const RecordBody = z.object({
  orderId: z.string().regex(/^0x[0-9a-fA-F]{64}$/),
  orderRef: z.string().regex(/^0x[0-9a-fA-F]{64}$/),
  merchantId: z.string().regex(/^0x[0-9a-fA-F]{64}$/),
  payer: z.string().regex(/^0x[0-9a-fA-F]{40}$/),
  fiatAmount: z.number().int().positive(),
  currency: z.string(),
  usdcAmount: z.string(),
  openUntil: z.number().int(),
  txHash: z.string().optional(),
});

export async function orderRoutes(app: FastifyInstance) {
  app.get("/orders", async (req) => {
    const q = req.query as Record<string, string | undefined>;
    return listOrders({
      payer: q.payer,
      merchant_id: q.merchantId,
      status: q.status,
      limit: q.limit ? Number(q.limit) : 100,
    });
  });

  app.get("/orders/:id", async (req, reply) => {
    const { id } = req.params as { id: string };
    const row = getOrder(id);
    if (!row) return reply.code(404).send({ error: "order not found" });
    return row;
  });

  // Called by the web app after a successful onchain `pay` so the server
  // has the row immediately (the chain watcher reconciles within ~1s).
  app.post("/orders/record", async (req, reply) => {
    const parsed = RecordBody.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    const d = parsed.data;
    recordOrder({
      order_id: d.orderId, order_ref: d.orderRef, merchant_id: d.merchantId, payer: d.payer,
      fiat_amount: d.fiatAmount, currency: d.currency, usdc_amount: d.usdcAmount,
      status: "open", route: null, assigned_lp: null,
      payment_ref: null, net_amount: null, fee: null,
      created_at: Date.now(), open_until: d.openUntil, pay_deadline: null, settled_at: null,
      tx_create: d.txHash ?? null,
      tx_accept: null, tx_mark_paid: null, tx_route: null, tx_settle: null,
    });
    return { ok: true };
  });
}
