/**
 * @file src/lib/trackingStatus.ts
 * @description Pure conversion of stored settings into the public tracking
 * status, and the stopwatch math.
 */

import type { RunTotals, TrackingState, TrackingStatus } from "@/types";
import { overlapSeconds } from "@/lib/time";

export function asTrackingState(value: string): TrackingState {
  return value === "RUNNING" || value === "PAUSED" ? value : "STOPPED";
}

export function toStatus(settings: { trackingState: string; runStartedAt: Date | null }): TrackingStatus {
  const state = asTrackingState(settings.trackingState);
  return {
    state,
    runStartedAt: state !== "STOPPED" && settings.runStartedAt ? settings.runStartedAt.toISOString() : null
  };
}

export interface RecordedStretch {
  startedAt: Date;
  /** Where the recording ends (last heartbeat for an open session). */
  end: Date;
  isIdle: boolean;
  productive: boolean;
  outside: boolean;
}

export const EMPTY_RUN: RunTotals = { recordedSeconds: 0, trackedSeconds: 0, productiveSeconds: 0, idleSeconds: 0, outsideSeconds: 0 };

/**
 * The current session: time recorded since play was pressed. Pauses and gaps
 * (computer asleep) produce no session, so they are not counted.
 */
export function runTotals(sessions: RecordedStretch[], runStartedAt: Date | null, now: Date): RunTotals {
  if (!runStartedAt) return EMPTY_RUN;
  const totals = { ...EMPTY_RUN };
  for (const session of sessions) {
    const seconds = overlapSeconds(session.startedAt, session.end, runStartedAt, now);
    totals.recordedSeconds += seconds;
    if (session.isIdle) {
      totals.idleSeconds += seconds;
      continue;
    }
    totals.trackedSeconds += seconds;
    if (session.productive) totals.productiveSeconds += seconds;
    if (session.outside) totals.outsideSeconds += seconds;
  }
  return totals;
}
