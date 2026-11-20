/**
 * @file src/lib/liveGroups.ts
 * @description Keeps the ring in step with the live total. Reports only count
 * time up to the last heartbeat (every 30s), while the total ticks every
 * second: the difference belongs to the session in progress.
 */

import type { CategoryBreakdown, CategoryRef } from "@/types";

type Group = Omit<CategoryBreakdown, "sessions">;

/**
 * Adds `liveTotal - sum(groups)` to the category of the session in progress,
 * then recomputes the percentages. Without it, a session that just started
 * shows an empty ring until the next heartbeat.
 */
export function withLiveTime(groups: Group[], liveTotal: number, current: CategoryRef | null): Group[] {
  const recorded = groups.reduce((total, group) => total + group.totalSeconds, 0);
  const extra = liveTotal - recorded;
  if (!current || extra <= 0) return groups;

  const known = groups.some((group) => group.category.id === current.id);
  const merged = known
    ? groups.map((group) => (group.category.id === current.id ? { ...group, totalSeconds: group.totalSeconds + extra } : group))
    : [...groups, { category: current, totalSeconds: extra, percentage: 0 }];

  return merged
    .map((group) => ({ ...group, percentage: Math.round((group.totalSeconds / liveTotal) * 1000) / 10 }))
    .sort((a, b) => b.totalSeconds - a.totalSeconds);
}
