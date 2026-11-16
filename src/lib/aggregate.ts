/**
 * @file src/lib/aggregate.ts
 * @description Pure aggregation of sessions into day / week / month reports:
 * categories, top sites, productivity score, limits and trends.
 */

import type {
  CategoryBreakdown,
  CategoryRef,
  DailyBreakdown,
  DaySession,
  FocusStretch,
  HeatmapDay,
  LimitAlert,
  MonthlyHeatmap,
  PreviousPeriod,
  ProductivityStats,
  SiteStat,
  WeeklyBreakdown
} from "@/types";
import { addDays, addMonths, dayRange, daysInMonth, overlapSeconds, startOfMonthKey } from "@/lib/time";

export interface RawSession {
  id: string;
  category: CategoryRef;
  startedAt: Date;
  endedAt: Date | null;
  durationSeconds: number;
  isIdle: boolean;
  heartbeatCount: number;
  /** Most visited host during the session. */
  host: string | null;
  /** Heartbeats per host, used to split the session's time between sites. */
  hostCounts: Record<string, number>;
}

interface Clipped {
  session: RawSession;
  seconds: number;
}

const TOP_SITES = 10;

export function sessionEnd(session: Pick<RawSession, "startedAt" | "endedAt" | "durationSeconds">): Date {
  return session.endedAt ?? new Date(session.startedAt.getTime() + session.durationSeconds * 1000);
}

/** Sessions overlapping [start, end), with the seconds that fall inside it. */
function clip(sessions: RawSession[], start: Date, end: Date): Clipped[] {
  return sessions
    .map((session) => ({
      session,
      seconds: overlapSeconds(session.startedAt, sessionEnd(session), start, end),
      touches: session.startedAt < end && sessionEnd(session) >= start
    }))
    .filter(({ session, seconds, touches }) => seconds > 0 || (touches && session.endedAt === null))
    .sort((a, b) => a.session.startedAt.getTime() - b.session.startedAt.getTime())
    .map(({ session, seconds }) => ({ session, seconds }));
}

const active = (items: Clipped[]) => items.filter((item) => !item.session.isIdle);
const sum = (items: Clipped[]) => items.reduce((acc, item) => acc + item.seconds, 0);

/** Sessions clipped to a single local day, chronological. */
export function sessionsForDay(sessions: RawSession[], dateKey: string): DaySession[] {
  const { start, end } = dayRange(dateKey);
  return clip(sessions, start, end).map(({ session, seconds }) => ({
    id: session.id,
    category: session.category,
    startedAt: session.startedAt.toISOString(),
    endedAt: session.endedAt ? session.endedAt.toISOString() : null,
    durationSeconds: seconds,
    isIdle: session.isIdle,
    isActive: session.endedAt === null,
    heartbeatCount: session.heartbeatCount,
    host: session.host
  }));
}

function groupByCategory(items: Clipped[]): CategoryBreakdown[] {
  const tracked = active(items);
  const total = sum(tracked);
  const groups = new Map<string, CategoryBreakdown>();

  for (const { session, seconds } of tracked) {
    const day: DaySession = {
      id: session.id,
      category: session.category,
      startedAt: session.startedAt.toISOString(),
      endedAt: session.endedAt ? session.endedAt.toISOString() : null,
      durationSeconds: seconds,
      isIdle: false,
      isActive: session.endedAt === null,
      heartbeatCount: session.heartbeatCount,
      host: session.host
    };
    const group = groups.get(session.category.id);
    if (group) {
      group.totalSeconds += seconds;
      group.sessions.push(day);
    } else {
      groups.set(session.category.id, { category: session.category, totalSeconds: seconds, percentage: 0, sessions: [day] });
    }
  }

  return Array.from(groups.values())
    .map((group) => ({ ...group, percentage: total > 0 ? Math.round((group.totalSeconds / total) * 1000) / 10 : 0 }))
    .sort((a, b) => b.totalSeconds - a.totalSeconds);
}

function withoutSessions(groups: CategoryBreakdown[]): Omit<CategoryBreakdown, "sessions">[] {
  return groups.map(({ category, totalSeconds, percentage }) => ({ category, totalSeconds, percentage }));
}

/** Time per website: each session's time is split between its hosts by heartbeat count. */
export function topSites(items: Clipped[], limit = TOP_SITES): SiteStat[] {
  const seconds = new Map<string, number>();
  const byCategory = new Map<string, Map<string, { category: CategoryRef; seconds: number }>>();

  for (const { session, seconds: clipped } of active(items)) {
    const counts = Object.entries(session.hostCounts);
    const beats = counts.reduce((acc, [, count]) => acc + count, 0);
    if (beats === 0) continue;
    for (const [host, count] of counts) {
      const share = (clipped * count) / beats;
      seconds.set(host, (seconds.get(host) ?? 0) + share);
      const categories = byCategory.get(host) ?? new Map<string, { category: CategoryRef; seconds: number }>();
      const entry = categories.get(session.category.id) ?? { category: session.category, seconds: 0 };
      entry.seconds += share;
      categories.set(session.category.id, entry);
      byCategory.set(host, categories);
    }
  }

  return Array.from(seconds.entries())
    .map(([host, total]) => {
      const main = Array.from(byCategory.get(host)?.values() ?? []).sort((a, b) => b.seconds - a.seconds)[0];
      return { host, seconds: Math.round(total), category: main.category };
    })
    .filter((site) => site.seconds > 0)
    .sort((a, b) => b.seconds - a.seconds)
    .slice(0, limit);
}

export function productivityOf(items: Clipped[]): ProductivityStats {
  let productiveSeconds = 0;
  let neutralSeconds = 0;
  let distractingSeconds = 0;
  for (const { session, seconds } of active(items)) {
    if (session.category.productivity === "PRODUCTIVE") productiveSeconds += seconds;
    else if (session.category.productivity === "DISTRACTING") distractingSeconds += seconds;
    else neutralSeconds += seconds;
  }
  const total = productiveSeconds + neutralSeconds + distractingSeconds;
  return {
    productiveSeconds,
    neutralSeconds,
    distractingSeconds,
    score: total > 0 ? Math.round((productiveSeconds / total) * 100) : null
  };
}

export function limitAlertsOf(groups: Omit<CategoryBreakdown, "sessions">[]): LimitAlert[] {
  return groups
    .filter((group) => group.category.dailyLimitSeconds !== null && group.totalSeconds >= group.category.dailyLimitSeconds)
    .map((group) => ({
      category: group.category,
      usedSeconds: group.totalSeconds,
      limitSeconds: group.category.dailyLimitSeconds as number
    }));
}

function previousOf(items: Clipped[]): PreviousPeriod {
  return { totalTrackedSeconds: sum(active(items)), productivityScore: productivityOf(items).score };
}

function longestFocusOf(items: Clipped[]): FocusStretch | null {
  const best = active(items).reduce<Clipped | null>((acc, item) => (!acc || item.seconds > acc.seconds ? item : acc), null);
  if (!best) return null;
  return {
    category: best.session.category,
    startedAt: best.session.startedAt.toISOString(),
    endedAt: best.session.endedAt ? best.session.endedAt.toISOString() : null,
    seconds: best.seconds
  };
}

/** Sessions must cover the day and the day before (for the trend). */
export function buildDailyBreakdown(sessions: RawSession[], dateKey: string, audioBeats: AudioBeat[] = []): DailyBreakdown {
  const { start, end } = dayRange(dateKey);
  const items = clip(sessions, start, end);
  const categories = groupByCategory(items);
  const yesterday = dayRange(addDays(dateKey, -1));

  return {
    date: dateKey,
    totalTrackedSeconds: sum(active(items)),
    idleSeconds: sum(items.filter((item) => item.session.isIdle)),
    sessionCount: active(items).length,
    longestFocus: longestFocusOf(items),
    categories,
    sites: topSites(items),
    productivity: productivityOf(items),
    limitAlerts: limitAlertsOf(categories),
    previous: previousOf(clip(sessions, yesterday.start, yesterday.end)),
    backgroundAudio: backgroundAudioTotals(audioBeats)
  };
}

/** Sessions must cover the week and the week before. */
export function buildWeeklyBreakdown(sessions: RawSession[], weekStartKey: string): WeeklyBreakdown {
  const days = Array.from({ length: 7 }, (_, index) => {
    const date = addDays(weekStartKey, index);
    const { start, end } = dayRange(date);
    const items = clip(sessions, start, end);
    return {
      date,
      totalTrackedSeconds: sum(active(items)),
      productivityScore: productivityOf(items).score,
      categories: withoutSessions(groupByCategory(items))
    };
  });

  const range = { start: dayRange(weekStartKey).start, end: dayRange(addDays(weekStartKey, 6)).end };
  const items = clip(sessions, range.start, range.end);
  const previousStart = dayRange(addDays(weekStartKey, -7)).start;

  return {
    weekStart: weekStartKey,
    totalTrackedSeconds: days.reduce((acc, day) => acc + day.totalTrackedSeconds, 0),
    days,
    weeklyTotals: withoutSessions(groupByCategory(items)),
    sites: topSites(items),
    productivity: productivityOf(items),
    previous: previousOf(clip(sessions, previousStart, range.start))
  };
}

export function intensityFor(total: number, max: number): HeatmapDay["intensity"] {
  if (total <= 0 || max <= 0) return 0;
  return Math.min(4, Math.max(1, Math.ceil((total / max) * 4))) as HeatmapDay["intensity"];
}

/** Sessions must cover the month and the month before. */
export function buildMonthlyHeatmap(sessions: RawSession[], dateKey: string): MonthlyHeatmap {
  const monthStart = startOfMonthKey(dateKey);
  const totals = Array.from({ length: daysInMonth(monthStart) }, (_, index) => {
    const date = addDays(monthStart, index);
    const { start, end } = dayRange(date);
    return { date, total: sum(active(clip(sessions, start, end))) };
  });

  const max = totals.reduce((acc, day) => Math.max(acc, day.total), 0);
  const best = totals.reduce<{ date: string; total: number } | null>(
    (acc, day) => (day.total > 0 && (!acc || day.total > acc.total) ? day : acc),
    null
  );
  const range = { start: dayRange(monthStart).start, end: dayRange(addMonths(monthStart, 1)).start };
  const items = clip(sessions, range.start, range.end);
  const previousStart = dayRange(addMonths(monthStart, -1)).start;

  return {
    month: monthStart.slice(0, 7),
    days: totals.map(({ date, total }) => ({ date, totalTrackedSeconds: total, intensity: intensityFor(total, max) })),
    monthlyTotal: totals.reduce((acc, day) => acc + day.total, 0),
    activeDays: totals.filter((day) => day.total > 0).length,
    mostProductiveDate: best?.date ?? null,
    categories: withoutSessions(groupByCategory(items)),
    sites: topSites(items),
    productivity: productivityOf(items),
    previous: previousOf(clip(sessions, previousStart, range.start))
  };
}

/** Today at a glance (badge, popup, notifications). */
export function pulseOf(sessions: RawSession[], dateKey: string, host: string | null) {
  const { start, end } = dayRange(dateKey);
  const items = clip(sessions, start, end);
  const site = host ? topSites(items, Number.MAX_SAFE_INTEGER).find((entry) => entry.host === host) : undefined;
  return {
    todayTrackedSeconds: sum(active(items)),
    site: host ? { host, todaySeconds: site?.seconds ?? 0 } : null,
    limitAlerts: limitAlertsOf(withoutSessions(groupByCategory(items)))
  };
}

export interface AudioBeat {
  timestamp: Date;
  /** Comma-separated hosts playing sound in background tabs, or null. */
  backgroundAudio: string | null;
}

/**
 * Time each site played sound in a background tab. Every heartbeat covers the
 * time until the next one, capped at the 30s heartbeat interval.
 */
export function backgroundAudioTotals(beats: AudioBeat[], limit = 5): { host: string; seconds: number }[] {
  const sorted = [...beats].sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
  const totals = new Map<string, number>();
  sorted.forEach((beat, index) => {
    if (!beat.backgroundAudio) return;
    const next = sorted[index + 1];
    const span = next ? Math.min(30, Math.round((next.timestamp.getTime() - beat.timestamp.getTime()) / 1000)) : 30;
    for (const host of beat.backgroundAudio.split(",").filter(Boolean)) {
      totals.set(host, (totals.get(host) ?? 0) + span);
    }
  });
  return Array.from(totals.entries())
    .map(([host, seconds]) => ({ host, seconds }))
    .filter((entry) => entry.seconds > 0)
    .sort((a, b) => b.seconds - a.seconds)
    .slice(0, limit);
}
