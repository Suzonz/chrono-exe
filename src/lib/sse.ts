/**
 * @file src/lib/sse.ts
 * @description SSE client registry, broadcaster and periodic refresh monitor.
 *
 * Next.js compiles each route into its own bundle, so module-level state is not
 * shared between `/api/heartbeat` and `/api/sse`. The registry therefore lives
 * on `globalThis`, which is shared by every route in the same server process.
 */

import type { DashboardState, SSEEvent } from "@/types";
import { buildDashboardState } from "@/lib/dashboard";
import { isDbUnreachable } from "@/lib/api";

type Client = { send: (chunk: string) => void };

interface SSERegistry {
  clients: Set<Client>;
  monitor: ReturnType<typeof setInterval> | null;
}

const MONITOR_INTERVAL_MS = 15000;

const store = globalThis as unknown as { __chronoSSE?: SSERegistry };
const registry: SSERegistry = store.__chronoSSE ?? { clients: new Set<Client>(), monitor: null };
store.__chronoSSE = registry;

export function serializeEvent<T>(event: SSEEvent<T>): string {
  return `event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`;
}

export function addSSEClient(send: (chunk: string) => void): () => void {
  const client: Client = { send };
  registry.clients.add(client);
  ensureMonitor();
  return () => {
    registry.clients.delete(client);
  };
}

export function clientCount(): number {
  return registry.clients.size;
}

export function broadcast<T>(event: SSEEvent<T>): void {
  const payload = serializeEvent(event);
  for (const client of registry.clients) {
    try {
      client.send(payload);
    } catch {
      registry.clients.delete(client);
    }
  }
}

/** Snapshot event for the dashboard, or a DB_UNREACHABLE event. */
export async function snapshotEvent(): Promise<SSEEvent<DashboardState | { message: string }>> {
  const timestamp = new Date().toISOString();
  try {
    return { type: "DASHBOARD_UPDATE", data: await buildDashboardState(), timestamp };
  } catch (error) {
    if (!isDbUnreachable(error)) {
      console.error("[sse] snapshot failed", error);
    }
    return { type: "DB_UNREACHABLE", data: { message: "Database unreachable" }, timestamp };
  }
}

export async function broadcastSnapshot(): Promise<void> {
  if (registry.clients.size === 0) return;
  broadcast(await snapshotEvent());
}

/**
 * Periodically re-broadcasts the dashboard so stale sessions get closed and the
 * EXTENSION_OFFLINE / DB_UNREACHABLE states surface even without heartbeats.
 */
function ensureMonitor(): void {
  if (registry.monitor) return;
  registry.monitor = setInterval(() => {
    if (registry.clients.size === 0) return;
    void broadcastSnapshot();
  }, MONITOR_INTERVAL_MS);
}
