/**
 * @file src/lib/stats.ts
 * @description Database access for stats: loads sessions overlapping a range,
 * with the hosts visited during each session.
 */

import prisma from "@/lib/prisma";
import { hostOf } from "@/lib/glob";
import { toCategoryRef } from "@/lib/categoryRef";
import type { RawSession } from "@/lib/aggregate";

/** Longest session we look back for when a range starts (sessions crossing midnight). */
const LOOKBACK_MS = 24 * 3600 * 1000;

function mostVisited(counts: Record<string, number>): string | null {
  let best: string | null = null;
  let bestCount = 0;
  for (const [host, count] of Object.entries(counts)) {
    if (count > bestCount) {
      best = host;
      bestCount = count;
    }
  }
  return best;
}

export async function loadSessions(start: Date, end: Date, options: { withHosts?: boolean } = {}): Promise<RawSession[]> {
  const rows = await prisma.session.findMany({
    where: { startedAt: { gte: new Date(start.getTime() - LOOKBACK_MS), lt: end } },
    include: { category: true },
    orderBy: { startedAt: "asc" }
  });

  const counts = new Map<string, Record<string, number>>();
  if (options.withHosts && rows.length > 0) {
    const heartbeats = await prisma.heartbeat.findMany({
      where: { sessionId: { in: rows.map((row) => row.id) } },
      select: { sessionId: true, url: true }
    });
    for (const beat of heartbeats) {
      const host = hostOf(beat.url);
      if (!host) continue;
      const perSession = counts.get(beat.sessionId) ?? {};
      perSession[host] = (perSession[host] ?? 0) + 1;
      counts.set(beat.sessionId, perSession);
    }
  }

  return rows.map((row) => {
    const hostCounts = counts.get(row.id) ?? {};
    return {
      id: row.id,
      category: toCategoryRef(row.category),
      startedAt: row.startedAt,
      endedAt: row.endedAt,
      durationSeconds: row.durationSeconds,
      isIdle: row.isIdle,
      heartbeatCount: row.heartbeatCount,
      host: mostVisited(hostCounts),
      hostCounts
    };
  });
}

/** Heartbeats of a range with their background-audio hosts. */
export async function loadAudioBeats(start: Date, end: Date) {
  return prisma.heartbeat.findMany({
    where: { timestamp: { gte: start, lt: end } },
    select: { timestamp: true, backgroundAudio: true },
    orderBy: { timestamp: "asc" }
  });
}
