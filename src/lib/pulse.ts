/**
 * @file src/lib/pulse.ts
 * @description "Today at a glance" for the extension: total, current site, limits.
 */

import type { Pulse } from "@/types";
import { loadSessions } from "@/lib/stats";
import { pulseOf } from "@/lib/aggregate";
import { hostOf } from "@/lib/glob";
import { dayRange, todayKey } from "@/lib/time";

export async function computePulse(currentUrl: string | null): Promise<Pulse> {
  const key = todayKey();
  const { start, end } = dayRange(key);
  const sessions = await loadSessions(start, end, { withHosts: true });
  return pulseOf(sessions, key, currentUrl ? hostOf(currentUrl) : null);
}
