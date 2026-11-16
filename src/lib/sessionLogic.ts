/**
 * @file src/lib/sessionLogic.ts
 * @description Pure session state machine. Given the active session and an incoming
 * heartbeat, decides what must happen. Kept free of I/O so it can be unit-tested.
 */

/** Interval at which the extension sends heartbeats. */
export const HEARTBEAT_INTERVAL_SECONDS = 30;

/** Without a heartbeat for this long, the extension is considered offline. */
export function inactivityThresholdMs(): number {
  const raw = Number(process.env.SSE_INACTIVITY_THRESHOLD_MS ?? "120000");
  return Number.isFinite(raw) && raw >= 60000 ? raw : 120000;
}

export interface ActiveSessionSnapshot {
  categoryId: string;
  isIdle: boolean;
  startedAt: Date;
  durationSeconds: number;
}

export interface IncomingHeartbeat {
  categoryId: string;
  isIdle: boolean;
  timestamp: Date;
}

export type HeartbeatDecision =
  /** No open session: open one. */
  | { kind: "start" }
  /** Same category and idle state: extend the open session. */
  | { kind: "extend"; durationSeconds: number }
  /** Category or idle state changed: close at `endedAt`, open a new one. */
  | { kind: "switch"; endedAt: Date; durationSeconds: number }
  /** Tracking gap (sleep, Chrome closed): close the old session where it really ended. */
  | { kind: "gap"; endedAt: Date; durationSeconds: number }
  /** Older than the last recorded heartbeat (late retry): keep it out of the session math. */
  | { kind: "stale" };

/** Timestamp of the last heartbeat folded into a session. */
export function lastBeatOf(session: ActiveSessionSnapshot): Date {
  return new Date(session.startedAt.getTime() + session.durationSeconds * 1000);
}

/** Moment a session should be considered finished if no more heartbeats arrive. */
export function closingTimeOf(session: ActiveSessionSnapshot): Date {
  return new Date(lastBeatOf(session).getTime() + HEARTBEAT_INTERVAL_SECONDS * 1000);
}

export function isSessionStale(session: ActiveSessionSnapshot, now: Date, thresholdMs: number): boolean {
  return now.getTime() - lastBeatOf(session).getTime() > thresholdMs;
}

export function decideHeartbeat(
  active: ActiveSessionSnapshot | null,
  beat: IncomingHeartbeat,
  thresholdMs: number
): HeartbeatDecision {
  if (!active) {
    return { kind: "start" };
  }

  const lastBeat = lastBeatOf(active);
  const sinceLast = beat.timestamp.getTime() - lastBeat.getTime();

  if (sinceLast < 0) {
    return { kind: "stale" };
  }

  if (sinceLast > thresholdMs) {
    const endedAt = closingTimeOf(active);
    return {
      kind: "gap",
      endedAt,
      durationSeconds: Math.floor((endedAt.getTime() - active.startedAt.getTime()) / 1000)
    };
  }

  const elapsed = Math.floor((beat.timestamp.getTime() - active.startedAt.getTime()) / 1000);

  if (active.categoryId === beat.categoryId && active.isIdle === beat.isIdle) {
    return { kind: "extend", durationSeconds: Math.max(active.durationSeconds, elapsed) };
  }

  return { kind: "switch", endedAt: beat.timestamp, durationSeconds: Math.max(active.durationSeconds, elapsed) };
}
