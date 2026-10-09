import { EventEmitter } from "node:events";

const globalForBus = globalThis as unknown as { __vlBus?: EventEmitter };

/** In-process pub/sub. Safe because the app runs as a single instance. */
export const bus: EventEmitter =
  globalForBus.__vlBus ?? (globalForBus.__vlBus = new EventEmitter());

bus.setMaxListeners(0);

export function notifyRound(roundId: number): void {
  bus.emit(`round:${roundId}`);
  bus.emit("any");
}

export function roundChannel(roundId: number): string {
  return `round:${roundId}`;
}
