/**
 * @file src/lib/sessionManager.ts
 * @description Applies session state-machine decisions to the database.
 */

import prisma from "@/lib/prisma";
import {
  closingTimeOf,
  decideHeartbeat,
  inactivityThresholdMs,
  isSessionStale
} from "@/lib/sessionLogic";

export interface HeartbeatInput {
  url: string;
  title: string;
  timestamp: Date;
  idleSeconds: number;
  categoryId: string;
  isIdle: boolean;
  /** Hosts playing sound in background tabs at that moment. */
  backgroundAudio?: string[];
}

export interface ProcessedHeartbeat {
  sessionId: string;
  duplicate: boolean;
}

/**
 * Folds a heartbeat into the session timeline. Idempotent: replaying the same
 * heartbeat (same timestamp) never creates a duplicate session or heartbeat.
 */
export async function processHeartbeat(input: HeartbeatInput): Promise<ProcessedHeartbeat> {
  return prisma.$transaction(async (tx) => {
    const duplicate = await tx.heartbeat.findFirst({ where: { timestamp: input.timestamp } });
    if (duplicate) {
      return { sessionId: duplicate.sessionId, duplicate: true };
    }

    const active = await tx.session.findFirst({
      where: { endedAt: null },
      orderBy: { startedAt: "desc" }
    });

    const decision = decideHeartbeat(active, input, inactivityThresholdMs());

    const heartbeatData = {
      url: input.url,
      title: input.title,
      categoryId: input.categoryId,
      isIdle: input.isIdle,
      idleSeconds: input.idleSeconds,
      timestamp: input.timestamp,
      backgroundAudio: input.backgroundAudio && input.backgroundAudio.length > 0 ? input.backgroundAudio.join(",").slice(0, 1024) : null
    };

    if (active && decision.kind === "stale") {
      await tx.heartbeat.create({ data: { ...heartbeatData, sessionId: active.id } });
      return { sessionId: active.id, duplicate: false };
    }

    if (active && decision.kind === "extend") {
      await tx.session.update({
        where: { id: active.id },
        data: { durationSeconds: decision.durationSeconds, heartbeatCount: { increment: 1 } }
      });
      await tx.heartbeat.create({ data: { ...heartbeatData, sessionId: active.id } });
      return { sessionId: active.id, duplicate: false };
    }

    if (active && (decision.kind === "switch" || decision.kind === "gap")) {
      await tx.session.update({
        where: { id: active.id },
        data: { endedAt: decision.endedAt, durationSeconds: decision.durationSeconds }
      });
    }

    const opened = await tx.session.create({
      data: {
        categoryId: input.categoryId,
        startedAt: input.timestamp,
        isIdle: input.isIdle,
        durationSeconds: 0,
        heartbeatCount: 1
      }
    });
    await tx.heartbeat.create({ data: { ...heartbeatData, sessionId: opened.id } });
    return { sessionId: opened.id, duplicate: false };
  });
}

/**
 * Closes the open session if the extension stopped reporting.
 * Returns true when a session was closed.
 */
export async function closeStaleSession(now = new Date()): Promise<boolean> {
  const active = await prisma.session.findFirst({
    where: { endedAt: null },
    orderBy: { startedAt: "desc" }
  });
  if (!active || !isSessionStale(active, now, inactivityThresholdMs())) {
    return false;
  }
  const endedAt = closingTimeOf(active);
  await prisma.session.update({
    where: { id: active.id },
    data: {
      endedAt,
      durationSeconds: Math.floor((endedAt.getTime() - active.startedAt.getTime()) / 1000)
    }
  });
  return true;
}
