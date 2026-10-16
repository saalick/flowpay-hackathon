import { EventEmitter } from "node:events";

export type Topic =
  | "order.created" | "order.accepted" | "order.marked_paid"
  | "order.settled" | "order.routed" | "order.disputed" | "order.refunded"
  | "lp.updated" | "admin.flag" | "trip.created" | "voice.message" | "server.hello";

export type EventMessage = {
  topic: Topic;
  ts: number;
  data: Record<string, unknown>;
};

class Bus extends EventEmitter {}
export const bus = new Bus();
bus.setMaxListeners(100);

export function publish(topic: Topic, data: Record<string, unknown>) {
  const msg: EventMessage = { topic, ts: Date.now(), data };
  bus.emit("event", msg);
}
