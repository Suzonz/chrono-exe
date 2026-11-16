import { NextResponse } from "next/server";
import { z } from "zod";
import type { HeartbeatResponse } from "@/types";
import { handleError, parseBody } from "@/lib/api";
import { isIgnored } from "@/lib/ignoreList";
import { categorize, FALLBACK_CATEGORY, getCategoryByName, IDLE_CATEGORY, OUTSIDE_CATEGORY } from "@/lib/categorizer";
import { sanitizeUrl } from "@/lib/glob";
import { processHeartbeat } from "@/lib/sessionManager";
import { broadcast, snapshotEvent } from "@/lib/sse";
import { getSettings, recordPresence } from "@/lib/dashboard";
import { rememberPage } from "@/lib/tracking";
import { toStatus } from "@/lib/trackingStatus";
import { toCategoryRef } from "@/lib/categoryRef";
import { computePulse } from "@/lib/pulse";
import prisma from "@/lib/prisma";

export const dynamic = "force-dynamic";

/** Heartbeats claiming to come from further in the future are clamped to now. */
const MAX_CLOCK_SKEW_MS = 60000;

const heartbeatSchema = z.object({
  url: z.string().url().max(8192),
  title: z.string().max(4096).default(""),
  timestamp: z.string().datetime({ offset: true }),
  idleSeconds: z.number().int().min(0).max(31_536_000).default(0),
  /** Hosts playing sound in background tabs. */
  backgroundAudio: z.array(z.string().min(1).max(255)).max(20).default([])
});

const OUTSIDE_CHROME_URL = "chrono://outside.chrome";
const isWebPage = (url: string) => /^https?:\/\//i.test(url);

/** The dashboard tab itself is never tracked, whatever port it runs on. */
function isOwnDashboard(url: string, request: Request): boolean {
  try {
    const host = new URL(url).host;
    const own = request.headers.get("host") ?? new URL(request.url).host;
    const normalize = (value: string) => value.replace(/^(127\.0\.0\.1|\[::1\])(?=:|$)/, "localhost");
    return normalize(host) === normalize(own);
  } catch {
    return false;
  }
}

export async function POST(request: Request): Promise<NextResponse> {
  const parsed = await parseBody(request, heartbeatSchema);
  if (!parsed.ok) return parsed.response;
  const payload = parsed.data;

  try {
    const now = Date.now();
    const sent = new Date(payload.timestamp).getTime();
    const timestamp = new Date(sent - now > MAX_CLOCK_SKEW_MS ? now : sent);
    // Second precision keeps duplicate detection reliable across retries.
    timestamp.setMilliseconds(0);

    let response: HeartbeatResponse extends infer R ? (R extends unknown ? Omit<R, "pulse"> : never) : never;
    // Any heartbeat, even an ignored one, proves the extension is alive.
    recordPresence(new Date(now));

    const settings = await getSettings();
    const trackingState = toStatus(settings).state;
    const onDashboard = isOwnDashboard(payload.url, request);
    const outside = payload.url === OUTSIDE_CHROME_URL;
    if (!onDashboard && isWebPage(payload.url)) rememberPage(payload.url, payload.title);

    if (trackingState !== "RUNNING") {
      // START has not been pressed (or tracking is paused): nothing is stored.
      response = { ignored: true, reason: trackingState, trackingState };
    } else if (!onDashboard && isWebPage(payload.url) && (await isIgnored(payload.url))) {
      response = { ignored: true, reason: "IGNORED", trackingState };
    } else {
      const isIdle = payload.idleSeconds >= settings.inactivityDelaySeconds;
      // Looking at the dashboard continues the current activity instead of breaking it.
      const active = onDashboard && !isIdle ? await prisma.session.findFirst({ where: { endedAt: null, isIdle: false }, include: { category: true } }) : null;
      const category = isIdle
        ? await getCategoryByName(IDLE_CATEGORY)
        : outside
          ? await getCategoryByName(OUTSIDE_CATEGORY)
          : active
            ? toCategoryRef(active.category)
            : onDashboard
              ? await getCategoryByName(FALLBACK_CATEGORY)
              : await categorize(payload.url);

      const result = await processHeartbeat({
        // Time on the dashboard itself shows up as "chrono.dashboard" in top sites.
        // Query strings are dropped and page titles are not stored (privacy).
        url: onDashboard ? "chrono://chrono.dashboard" : sanitizeUrl(payload.url),
        title: "",
        backgroundAudio: payload.backgroundAudio,
        timestamp,
        idleSeconds: payload.idleSeconds,
        categoryId: category.id,
        isIdle
      });

      response = {
        ignored: false,
        sessionId: result.sessionId,
        categoryId: category.id,
        categoryName: category.name,
        categoryColor: category.color,
        isIdle,
        trackingState
      };
    }

    broadcast(await snapshotEvent());
    const pulse = await computePulse(onDashboard || !isWebPage(payload.url) ? null : payload.url);
    return NextResponse.json({ ...response, pulse } as HeartbeatResponse, { status: 200 });
  } catch (error: unknown) {
    const failure = handleError(error, "heartbeat");
    if (failure.status === 503) {
      broadcast({ type: "DB_UNREACHABLE", data: { message: "Database unreachable" }, timestamp: new Date().toISOString() });
    }
    return failure;
  }
}
