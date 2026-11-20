/**
 * @file src/lib/tracking.ts
 * @description START / PAUSE / STOP control. Heartbeats are only stored while
 * tracking is RUNNING. A run starts on play and survives pauses;
 * the stopwatch itself is computed from recorded sessions (trackingStatus.ts).
 */

import prisma from "@/lib/prisma";
import type { TrackingAction, TrackingStatus } from "@/types";
import { asTrackingState, toStatus } from "@/lib/trackingStatus";
import { getSettings } from "@/lib/dashboard";
import { categorize, getCategoryByName, FALLBACK_CATEGORY } from "@/lib/categorizer";
import { processHeartbeat } from "@/lib/sessionManager";
import { closingTimeOf, inactivityThresholdMs, isSessionStale } from "@/lib/sessionLogic";

// Last page the extension reported (dashboard excluded), shared across route bundles.
// START uses it so the new session gets the right category immediately.
const memory = globalThis as unknown as { __chronoLastPage?: { url: string; title: string; at: number } };

export function rememberPage(url: string, title: string): void {
  memory.__chronoLastPage = { url, title, at: Date.now() };
}

function recentPage(): { url: string; title: string } | null {
  const page = memory.__chronoLastPage;
  return page && Date.now() - page.at <= inactivityThresholdMs() ? page : null;
}

export { toStatus };
const asState = asTrackingState;

export async function getTrackingStatus(): Promise<TrackingStatus> {
  return toStatus(await getSettings());
}

/** Closes the open session now, or where it really ended if the extension went silent. */
async function closeOpenSession(now: Date): Promise<void> {
  const active = await prisma.session.findFirst({ where: { endedAt: null }, orderBy: { startedAt: "desc" } });
  if (!active) return;
  const endedAt = isSessionStale(active, now, inactivityThresholdMs()) ? closingTimeOf(active) : now;
  await prisma.session.update({
    where: { id: active.id },
    data: {
      endedAt,
      durationSeconds: Math.max(active.durationSeconds, Math.floor((endedAt.getTime() - active.startedAt.getTime()) / 1000))
    }
  });
}

export async function applyTrackingAction(
  action: TrackingAction,
  page?: { url: string; title: string }
): Promise<TrackingStatus> {
  const settings = await getSettings();
  const state = asState(settings.trackingState);
  const now = new Date();
  now.setMilliseconds(0);

  if (action === "start") {
    // Resuming from pause keeps the run. Otherwise play starts a new one, also
    // when the state was left RUNNING by a server or computer that shut down.
    await prisma.settings.update({
      where: { id: settings.id },
      data: {
        trackingState: "RUNNING",
        runStartedAt: state === "PAUSED" && settings.runStartedAt ? settings.runStartedAt : now
      }
    });
    // Open a session right away so the dashboard reacts instantly.
    const source = page ?? recentPage();
    const category = source ? await categorize(source.url) : await getCategoryByName(FALLBACK_CATEGORY);
    await processHeartbeat({
      url: (source?.url ?? "manual://start").slice(0, 512),
      title: (source?.title ?? "Manual start").slice(0, 256),
      timestamp: now,
      idleSeconds: 0,
      categoryId: category.id,
      isIdle: false
    });
  }

  if (action === "pause" && state === "RUNNING") {
    await closeOpenSession(now);
    await prisma.settings.update({ where: { id: settings.id }, data: { trackingState: "PAUSED" } });
  }

  if (action === "stop" && state !== "STOPPED") {
    await closeOpenSession(now);
    await prisma.settings.update({
      where: { id: settings.id },
      data: { trackingState: "STOPPED", runStartedAt: null }
    });
  }

  return getTrackingStatus();
}
