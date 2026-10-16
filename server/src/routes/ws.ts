import type { FastifyInstance } from "fastify";
import websocket from "@fastify/websocket";
import { bus, type EventMessage } from "../events.js";

export async function wsRoutes(app: FastifyInstance) {
  await app.register(websocket);
  app.get("/ws", { websocket: true }, (socket) => {
    const send = (msg: EventMessage) => {
      try { socket.send(JSON.stringify(msg)); } catch { /* client gone */ }
    };
    const onEvent = (msg: EventMessage) => send(msg);
    bus.on("event", onEvent);
    socket.send(JSON.stringify({ topic: "server.hello", ts: Date.now(), data: { ok: true } }));
    socket.on("close", () => bus.off("event", onEvent));
  });
}
