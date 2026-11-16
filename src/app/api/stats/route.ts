import { NextResponse } from "next/server";
import { z } from "zod";
import { handleError, parseQuery } from "@/lib/api";
import { loadAudioBeats, loadSessions } from "@/lib/stats";
import { buildDailyBreakdown, buildMonthlyHeatmap, buildWeeklyBreakdown } from "@/lib/aggregate";
import { addDays, addMonths, DATE_KEY_REGEX, dayRange, startOfMonthKey, startOfWeekKey } from "@/lib/time";

export const dynamic = "force-dynamic";

const querySchema = z.object({
  period: z.enum(["day", "week", "month"]),
  date: z.string().regex(DATE_KEY_REGEX)
});

export async function GET(request: Request): Promise<NextResponse> {
  const parsed = parseQuery(request, querySchema);
  if (!parsed.ok) return parsed.response;
  const { period, date } = parsed.data;

  try {
    if (period === "day") {
      // Includes the day before, for the "vs yesterday" trend.
      const sessions = await loadSessions(dayRange(addDays(date, -1)).start, dayRange(date).end, { withHosts: true });
      const audio = await loadAudioBeats(dayRange(date).start, dayRange(date).end);
      return NextResponse.json(buildDailyBreakdown(sessions, date, audio));
    }

    if (period === "week") {
      const weekStart = startOfWeekKey(date);
      const sessions = await loadSessions(dayRange(addDays(weekStart, -7)).start, dayRange(addDays(weekStart, 6)).end, { withHosts: true });
      return NextResponse.json(buildWeeklyBreakdown(sessions, weekStart));
    }

    const monthStart = startOfMonthKey(date);
    const sessions = await loadSessions(dayRange(addMonths(monthStart, -1)).start, dayRange(addMonths(monthStart, 1)).start, { withHosts: true });
    return NextResponse.json(buildMonthlyHeatmap(sessions, monthStart));
  } catch (error) {
    return handleError(error, "stats.get");
  }
}
