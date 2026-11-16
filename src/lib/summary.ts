/**
 * @file src/lib/summary.ts
 * @description Plain-English one-liners describing a day, week or month.
 */

import type { DailyBreakdown, MonthlyHeatmap, WeeklyBreakdown } from "@/types";
import { formatClock, formatCompact, weekdayShort } from "@/lib/time";
import { siteLabel } from "@/lib/glob";

const duration = (seconds: number) => formatCompact(seconds).toLowerCase();
const siteName = (host: string) => siteLabel(host);

export function summarizeDay(day: DailyBreakdown, isToday: boolean): string {
  if (day.totalTrackedSeconds === 0) {
    return isToday ? "Nothing recorded yet today. Press play to start tracking." : "Nothing was recorded on this day.";
  }
  const top = day.categories[0];
  const parts = [`${isToday ? "Today" : "This day"}: ${duration(day.totalTrackedSeconds)} of active time, mostly ${top.category.name} (${Math.round(top.percentage)}%).`];
  if (day.longestFocus && day.longestFocus.seconds >= 600) {
    const end = day.longestFocus.endedAt ? formatClock(day.longestFocus.endedAt) : "now";
    parts.push(`Longest focus: ${duration(day.longestFocus.seconds)} of ${day.longestFocus.category.name} (${formatClock(day.longestFocus.startedAt)}-${end}).`);
  }
  if (day.sites[0]) {
    parts.push(`Top site: ${siteName(day.sites[0].host)}.`);
  }
  return parts.join(" ");
}

export function summarizeWeek(week: WeeklyBreakdown): string {
  if (week.totalTrackedSeconds === 0) return "Nothing was recorded this week.";
  const top = week.weeklyTotals[0];
  const best = week.days.reduce((acc, day) => (day.totalTrackedSeconds > acc.totalTrackedSeconds ? day : acc), week.days[0]);
  return `This week: ${duration(week.totalTrackedSeconds)} of active time, mostly ${top.category.name} (${Math.round(top.percentage)}%). Busiest day: ${weekdayShort(best.date)} with ${duration(best.totalTrackedSeconds)}.`;
}

export function summarizeMonth(month: MonthlyHeatmap): string {
  if (month.monthlyTotal === 0) return "Nothing was recorded this month.";
  const top = month.categories[0];
  const average = month.activeDays > 0 ? month.monthlyTotal / month.activeDays : 0;
  return `This month: ${duration(month.monthlyTotal)} over ${month.activeDays} active days (${duration(average)} per day on average), mostly ${top.category.name}.`;
}
