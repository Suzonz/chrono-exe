import { NextResponse } from "next/server";
import { z } from "zod";
import { handleError, parseBody } from "@/lib/api";
import { applyTrackingAction } from "@/lib/tracking";
import { broadcast, snapshotEvent } from "@/lib/sse";
import { computePulse } from "@/lib/pulse";
import { isLauncherManaged, scheduleShutdown } from "@/lib/launcher";
import type { DashboardState } from "@/types";

export const dynamic = "force-dynamic";

const postSchema = z.object({
  action: z.enum(["start", "pause", "stop"]),
  /** Optional current tab, sent by the extension popup so START gets the right category. */
  url: z.string().url().max(8192).optional(),
  title: z.string().max(4096).optional()
});

/**
 * Current tracking state + live snapshot + today at a glance, for the extension
 * popup. `?url=` is the current tab, to report the time spent on that site today.
 */
export async function GET(request: Request): Promise<NextResponse> {
  try {
    const event = await snapshotEvent();
    if (event.type !== "DASHBOARD_UPDATE") {
      return NextResponse.json({ code: "DB_UNREACHABLE", message: "Database unreachable" }, { status: 503 });
    }
    const url = new URL(request.url).searchParams.get("url");
    const pulse = await computePulse(url && /^https?:\/\//i.test(url) ? url : null);
    return NextResponse.json({ ...(event.data as DashboardState), pulse });
  } catch (error) {
    return handleError(error, "tracking.get");
  }
}

/**
 * START / PAUSE / STOP from the dashboard or the extension popup. When the
 * extension started the server (native launcher), STOP also shuts it down.
 */
export async function POST(request: Request): Promise<NextResponse> {
  const parsed = await parseBody(request, postSchema);
  if (!parsed.ok) return parsed.response;

  try {
    const page = parsed.data.url ? { url: parsed.data.url, title: parsed.data.title ?? "" } : undefined;
    await applyTrackingAction(parsed.data.action, page);
    const event = await snapshotEvent();
    broadcast(event);
    const serverStopping = parsed.data.action === "stop" && isLauncherManaged();
    if (serverStopping) {
      broadcast({ type: "SERVER_STOPPED", data: { message: "Server stopped" }, timestamp: new Date().toISOString() });
      scheduleShutdown();
    }
    return NextResponse.json(serverStopping ? { ...(event.data as DashboardState), serverStopping } : event.data);
  } catch (error) {
    return handleError(error, "tracking.post");
  }
}
