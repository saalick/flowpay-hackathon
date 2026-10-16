import Fastify from "fastify";
import cors from "@fastify/cors";
import { env } from "./env.js";
import { quoteRoutes } from "./routes/quote.js";
import { orderRoutes } from "./routes/orders.js";
import { adminRoutes } from "./routes/admin.js";
import { merchantRoutes } from "./routes/merchant.js";
import { lpRoutes } from "./routes/lp.js";
import { tripRoutes } from "./routes/trip.js";
import { payRoutes } from "./routes/pay.js";
import { wsRoutes } from "./routes/ws.js";
import { startEventWatchers, startOrchestrator } from "./orchestrator.js";

async function main() {
  const app = Fastify({ logger: { level: "info" } });

  await app.register(cors, {
    origin: (origin, cb) => {
      if (!origin) return cb(null, true);
      if (/^https?:\/\/localhost(:\d+)?$/.test(origin)) return cb(null, true);
      if (/^https?:\/\/127\.0\.0\.1(:\d+)?$/.test(origin)) return cb(null, true);
      if (/\.vercel\.app$/.test(origin)) return cb(null, true);
      if (origin === env.PUBLIC_WEB_ORIGIN) return cb(null, true);
      return cb(null, false);
    },
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  });

  // bigint-safe JSON
  app.setReplySerializer((payload) =>
    JSON.stringify(payload, (_k, v) => (typeof v === "bigint" ? v.toString() : v)),
  );

  app.get("/health", async () => ({ ok: true, chainId: env.CHAIN_ID, ts: Date.now() }));

  await app.register(wsRoutes);
  await app.register(quoteRoutes);
  await app.register(orderRoutes);
  await app.register(adminRoutes);
  await app.register(merchantRoutes);
  await app.register(lpRoutes);
  await app.register(tripRoutes);
  await app.register(payRoutes);

  startEventWatchers();
  startOrchestrator();

  await app.listen({ port: env.PORT, host: "0.0.0.0" });
  app.log.info({ port: env.PORT }, "FlowPay server up");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
