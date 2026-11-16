import { NextResponse } from "next/server";
import { z } from "zod";
import type { TimelineBlock } from "@/types";
import { handleError, parseQuery } from "@/lib/api";
import { loadSessions } from "@/lib/stats";
import { sessionEnd } from "@/lib/aggregate";
import { DATE_KEY_REGEX, dayRange } from "@/lib/time";

export const dynamic = "force-dynamic";

const querySchema = z.object({ date: z.string().regex(DATE_KEY_REGEX) });

/** Tracked blocks of a day, clipped to [00:00, 24:00). Gaps are untracked time. */
export async function GET(request: Request): Promise<NextResponse> {
  const parsed = parseQuery(request, querySchema);
  if (!parsed.ok) return parsed.response;

  try {
    const { start, end } = dayRange(parsed.data.date);
    const now = new Date();
    const sessions = await loadSessions(start, end, { withHosts: true });

    const blocks: TimelineBlock[] = sessions
      .map((session) => {
        const rawEnd = session.endedAt === null ? new Date(Math.max(now.getTime(), sessionEnd(session).getTime())) : sessionEnd(session);
        const from = new Date(Math.max(session.startedAt.getTime(), start.getTime()));
        const to = new Date(Math.min(rawEnd.getTime(), end.getTime()));
        return { session, from, to };
      })
      .filter(({ from, to }) => to.getTime() > from.getTime())
      .map(({ session, from, to }) => ({
        sessionId: session.id,
        startTime: from.toISOString(),
        endTime: to.toISOString(),
        category: session.category,
        isIdle: session.isIdle,
        isActive: session.endedAt === null,
        host: session.host
      }));

    return NextResponse.json(blocks);
  } catch (error) {
    return handleError(error, "timeline.get");
  }
}
