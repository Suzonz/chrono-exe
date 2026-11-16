/**
 * Report scope: everything recorded on the computer, or Chrome only.
 * "Chrome only" drops the OUTSIDE_CHROME activities (time spent in other apps)
 * before any total, percentage, score or trend is computed, so every figure on
 * the page describes the same thing.
 */
import type { RawSession } from "@/lib/aggregate";

export const SCOPES = ["all", "chrome"] as const;
export type Scope = (typeof SCOPES)[number];

/** Same name as OUTSIDE_CATEGORY in categorizer.ts (kept here so this stays pure). */
export const OUTSIDE_CHROME = "OUTSIDE_CHROME";

export function applyScope(sessions: RawSession[], scope: Scope): RawSession[] {
  return scope === "chrome" ? sessions.filter((session) => session.category.name !== OUTSIDE_CHROME) : sessions;
}
