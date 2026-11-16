/**
 * @file src/lib/dashboard.ts
 * @description Builds the live dashboard snapshot pushed over SSE.
 */

import type { DashboardState } from "@/types";
import prisma from "@/lib/prisma";
import { buildDailyBreakdown } from "@/lib/aggregate";
import { loadSessions } from "@/lib/stats";
import { closeStaleSession } from "@/lib/sessionManager";
import { inactivityThresholdMs, lastBeatOf } from "@/lib/sessionLogic";
import { dayRange, todayKey } from "@/lib/time";
import { isCategoryColor } from "@/lib/palette";
import { toStatus } from "@/lib/trackingStatus";
import { hostOf } from "@/lib/glob";
import { asProductivity } from "@/lib/categoryRef";

// Last time the extension reported in, including ignored heartbeats (e.g. while
// the user is looking at the dashboard). Shared across route bundles.
const presence = globalThis as unknown as { __chronoLastSeen?: Date };

export function recordPresence(at: Date): void {
  presence.__chronoLastSeen = at;
}

export async function getSettings() {
  const existing = await prisma.settings.findFirst();
  if (existing) return existing;
  return prisma.settings.create({ data: { dailyGoalSeconds: 14400, inactivityDelaySeconds: 300 } });
}

export async function buildDashboardState(now = new Date()): Promise<DashboardState> {
  await closeStaleSession(now);

  const key = todayKey();
  const { start, end } = dayRange(key);
  const threshold = inactivityThresholdMs();

  const [settings, sessions, active, lastHeartbeat] = await Promise.all([
    getSettings(),
    loadSessions(start, end),
    prisma.session.findFirst({
      where: { endedAt: null },
      include: { category: true },
      orderBy: { startedAt: "desc" }
    }),
    prisma.heartbeat.findFirst({ orderBy: { timestamp: "desc" }, select: { timestamp: true } })
  ]);

  const latestBeat = active
    ? await prisma.heartbeat.findFirst({ where: { sessionId: active.id }, orderBy: { timestamp: "desc" }, select: { url: true } })
    : null;
  const activeHost = latestBeat ? hostOf(latestBeat.url) : null;
  const breakdown = buildDailyBreakdown(sessions, key);
  const dominant = breakdown.categories[0]?.category ?? null;
  const lastStored = lastHeartbeat?.timestamp ?? null;
  const lastSeen = presence.__chronoLastSeen ?? null;
  const lastHeartbeatAt = lastSeen && (!lastStored || lastSeen > lastStored) ? lastSeen : lastStored;
  const extensionOnline = lastHeartbeatAt !== null && now.getTime() - lastHeartbeatAt.getTime() <= threshold;

  // Stored durations stop at the last heartbeat; count the open session up to "now"
  // so the client can keep ticking from `generatedAt` without jumps.
  const sinceLastBeat = active ? Math.max(0, Math.floor((now.getTime() - lastBeatOf(active).getTime()) / 1000)) : 0;
  const liveTracked = active && !active.isIdle ? sinceLastBeat : 0;
  const liveIdle = active && active.isIdle ? sinceLastBeat : 0;

  return {
    tracking: toStatus(settings),
    activeSession: active
      ? {
          sessionId: active.id,
          categoryId: active.categoryId,
          categoryName: active.category.name,
          categoryColor: isCategoryColor(active.category.color) ? active.category.color : "slate",
          startedAt: active.startedAt.toISOString(),
          elapsedSeconds: active.durationSeconds + sinceLastBeat,
          isIdle: active.isIdle,
          host: activeHost,
          productivity: asProductivity(active.category.productivity)
        }
      : null,
    dailyGoalSeconds: settings.dailyGoalSeconds,
    totalTrackedSeconds: breakdown.totalTrackedSeconds + liveTracked,
    productiveSeconds: breakdown.productivity.productiveSeconds + (active && active.category.productivity === "PRODUCTIVE" ? liveTracked : 0),
    idleSeconds: breakdown.idleSeconds + liveIdle,
    sessionCount: breakdown.sessionCount,
    dominantCategory: dominant,
    lastHeartbeatAt: lastHeartbeatAt ? lastHeartbeatAt.toISOString() : null,
    extensionOnline,
    inactivityThresholdMs: threshold,
    generatedAt: now.toISOString()
  };
}
