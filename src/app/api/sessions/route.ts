import { NextResponse } from "next/server";
import { z } from "zod";
import { handleError, parseQuery } from "@/lib/api";
import { loadSessions } from "@/lib/stats";
import { sessionsForDay } from "@/lib/aggregate";
import { DATE_KEY_REGEX, dayRange } from "@/lib/time";

export const dynamic = "force-dynamic";

const querySchema = z.object({
  date: z.string().regex(DATE_KEY_REGEX),
  categoryId: z.string().min(1).optional()
});

/** Chronological sessions of a day (durations clipped to that day). */
export async function GET(request: Request): Promise<NextResponse> {
  const parsed = parseQuery(request, querySchema);
  if (!parsed.ok) return parsed.response;

  try {
    const { start, end } = dayRange(parsed.data.date);
    const sessions = sessionsForDay(await loadSessions(start, end, { withHosts: true }), parsed.data.date);
    const filtered = parsed.data.categoryId
      ? sessions.filter((session) => session.category.id === parsed.data.categoryId)
      : sessions;
    return NextResponse.json(filtered);
  } catch (error) {
    return handleError(error, "sessions.get");
  }
}
