"use client";

import type { ActiveSessionState, CategoryRef, TrackingState } from "@/types";
import { stopwatchSeconds } from "@/lib/trackingStatus";
import { useLive } from "@/components/providers/LiveProvider";
import { useNow } from "@/hooks/useNow";
import { OUTSIDE_CHROME } from "@/lib/scope";

export interface DashboardView {
  ready: boolean;
  trackingState: TrackingState;
  /** START/PAUSE/STOP stopwatch, in seconds. */
  stopwatchSeconds: number;
  activeSession: ActiveSessionState | null;
  dailyGoalSeconds: number;
  totalTrackedSeconds: number;
  productiveSeconds: number;
  /** Active time in other apps today (OUTSIDE_CHROME). */
  outsideSeconds: number;
  idleSeconds: number;
  sessionCount: number;
  dominantCategory: CategoryRef | null;
  extensionOnline: boolean;
  lastHeartbeatAt: string | null;
  revision: number;
}

/**
 * Live dashboard values. Server snapshots arrive every heartbeat (30s); in
 * between, the open session keeps ticking locally once per second.
 */
export function useDashboard(): DashboardView {
  const { dashboardState: state, receivedAt, revision } = useLive();
  const now = useNow(1000);

  if (!state || receivedAt === null) {
    return {
      ready: false,
      trackingState: "STOPPED",
      stopwatchSeconds: 0,
      activeSession: null,
      dailyGoalSeconds: 14400,
      totalTrackedSeconds: 0,
      productiveSeconds: 0,
      outsideSeconds: 0,
      idleSeconds: 0,
      sessionCount: 0,
      dominantCategory: null,
      extensionOnline: false,
      lastHeartbeatAt: null,
      revision
    };
  }

  const lastBeat = state.lastHeartbeatAt ? new Date(state.lastHeartbeatAt).getTime() : null;
  const extensionOnline = lastBeat !== null && now - lastBeat <= state.inactivityThresholdMs;

  // Never tick past the point where the server would declare the session over.
  const tickLimit = lastBeat !== null ? lastBeat + state.inactivityThresholdMs : now;
  const drift = state.activeSession ? Math.max(0, Math.floor((Math.min(now, tickLimit) - receivedAt) / 1000)) : 0;
  const active = state.activeSession;

  return {
    ready: true,
    trackingState: state.tracking.state,
    stopwatchSeconds: stopwatchSeconds(state.tracking, now),
    activeSession: active ? { ...active, elapsedSeconds: active.elapsedSeconds + drift } : null,
    dailyGoalSeconds: state.dailyGoalSeconds,
    totalTrackedSeconds: state.totalTrackedSeconds + (active && !active.isIdle ? drift : 0),
    productiveSeconds: state.productiveSeconds + (active && !active.isIdle && active.productivity === "PRODUCTIVE" ? drift : 0),
    outsideSeconds: state.outsideSeconds + (active && !active.isIdle && active.categoryName === OUTSIDE_CHROME ? drift : 0),
    idleSeconds: state.idleSeconds + (active && active.isIdle ? drift : 0),
    sessionCount: state.sessionCount,
    dominantCategory: state.dominantCategory,
    extensionOnline,
    lastHeartbeatAt: state.lastHeartbeatAt,
    revision
  };
}
