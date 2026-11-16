/**
 * @file src/lib/trackingStatus.ts
 * @description Pure conversion of stored settings into the public tracking status.
 */

import type { TrackingState, TrackingStatus } from "@/types";

export function asTrackingState(value: string): TrackingState {
  return value === "RUNNING" || value === "PAUSED" ? value : "STOPPED";
}

export function toStatus(settings: { trackingState: string; runStartedAt: Date | null; runAccumulatedSeconds: number }): TrackingStatus {
  return {
    state: asTrackingState(settings.trackingState),
    runStartedAt: settings.runStartedAt ? settings.runStartedAt.toISOString() : null,
    accumulatedSeconds: settings.runAccumulatedSeconds
  };
}

/** Stopwatch value at `nowMs`: accumulated time plus the current running stretch. */
export function stopwatchSeconds(status: TrackingStatus, nowMs: number): number {
  const running = status.state === "RUNNING" && status.runStartedAt ? Math.max(0, Math.floor((nowMs - new Date(status.runStartedAt).getTime()) / 1000)) : 0;
  return status.accumulatedSeconds + running;
}
