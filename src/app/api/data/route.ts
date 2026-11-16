import { NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { handleError, parseBody } from "@/lib/api";
import { invalidateRulesCache } from "@/lib/categorizer";
import { invalidateIgnoreCache } from "@/lib/ignoreList";
import { broadcastSnapshot } from "@/lib/sse";

export const dynamic = "force-dynamic";

const EXPORT_VERSION = 1;

/** GET: full backup of your data as a JSON file. */
export async function GET(): Promise<NextResponse> {
  try {
    const [settings, categories, rules, ignorePatterns, sessions, heartbeats] = await Promise.all([
      prisma.settings.findMany(),
      prisma.category.findMany(),
      prisma.rule.findMany(),
      prisma.ignorePattern.findMany(),
      prisma.session.findMany({ orderBy: { startedAt: "asc" } }),
      prisma.heartbeat.findMany({ orderBy: { timestamp: "asc" } })
    ]);
    const body = JSON.stringify({ app: "CHRONO.EXE", version: EXPORT_VERSION, exportedAt: new Date().toISOString(), settings, categories, rules, ignorePatterns, sessions, heartbeats });
    const day = new Date().toISOString().slice(0, 10);
    return new NextResponse(body, {
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="chrono-backup-${day}.json"`
      }
    });
  } catch (error) {
    return handleError(error, "data.export");
  }
}

const date = z.coerce.date();
const nullableDate = z.coerce.date().nullable();

const backupSchema = z.object({
  app: z.literal("CHRONO.EXE"),
  version: z.literal(EXPORT_VERSION),
  settings: z.array(
    z.object({
      id: z.string(),
      dailyGoalSeconds: z.number().int(),
      inactivityDelaySeconds: z.number().int(),
      trackingState: z.string().default("STOPPED"),
      runStartedAt: nullableDate.default(null),
      runAccumulatedSeconds: z.number().int().default(0)
    })
  ),
  categories: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      color: z.string(),
      isDefault: z.boolean(),
      order: z.number().int(),
      productivity: z.string().default("NEUTRAL"),
      dailyLimitSeconds: z.number().int().nullable().default(null),
      createdAt: date
    })
  ),
  rules: z.array(z.object({ id: z.string(), pattern: z.string(), categoryId: z.string(), order: z.number().int(), createdAt: date })),
  ignorePatterns: z.array(z.object({ id: z.string(), pattern: z.string(), createdAt: date })),
  sessions: z.array(
    z.object({
      id: z.string(),
      categoryId: z.string(),
      startedAt: date,
      endedAt: nullableDate,
      durationSeconds: z.number().int(),
      isIdle: z.boolean(),
      heartbeatCount: z.number().int()
    })
  ),
  heartbeats: z.array(
    z.object({
      id: z.string(),
      url: z.string(),
      categoryId: z.string(),
      sessionId: z.string(),
      isIdle: z.boolean(),
      idleSeconds: z.number().int(),
      backgroundAudio: z.string().nullable().default(null),
      timestamp: date
    })
  )
});

const CHUNK = 500;

async function insertInChunks<T>(rows: T[], insert: (chunk: T[]) => Promise<unknown>): Promise<void> {
  for (let index = 0; index < rows.length; index += CHUNK) {
    await insert(rows.slice(index, index + CHUNK));
  }
}

/** POST: restore a backup. Everything currently stored is replaced. */
export async function POST(request: Request): Promise<NextResponse> {
  const parsed = await parseBody(request, backupSchema);
  if (!parsed.ok) return parsed.response;
  const backup = parsed.data;

  try {
    await prisma.$transaction(
      async (tx) => {
        await tx.heartbeat.deleteMany();
        await tx.session.deleteMany();
        await tx.rule.deleteMany();
        await tx.category.deleteMany();
        await tx.ignorePattern.deleteMany();
        await tx.settings.deleteMany();

        await tx.settings.createMany({ data: backup.settings });
        await tx.category.createMany({ data: backup.categories });
        await tx.rule.createMany({ data: backup.rules });
        await tx.ignorePattern.createMany({ data: backup.ignorePatterns });
        await insertInChunks(backup.sessions, (chunk) => tx.session.createMany({ data: chunk }));
        await insertInChunks(
          backup.heartbeats.map((beat) => ({ ...beat, title: "" })),
          (chunk) => tx.heartbeat.createMany({ data: chunk })
        );
      },
      { timeout: 120000 }
    );
    invalidateRulesCache();
    invalidateIgnoreCache();
    void broadcastSnapshot();
    return NextResponse.json({ restored: true, sessions: backup.sessions.length, heartbeats: backup.heartbeats.length });
  } catch (error) {
    return handleError(error, "data.import");
  }
}

const deleteSchema = z.object({ confirm: z.literal("DELETE HISTORY") });

/** DELETE: erase the whole tracking history. Categories, rules and settings are kept. */
export async function DELETE(request: Request): Promise<NextResponse> {
  const parsed = await parseBody(request, deleteSchema);
  if (!parsed.ok) return parsed.response;

  try {
    const [heartbeats, sessions] = await prisma.$transaction([prisma.heartbeat.deleteMany(), prisma.session.deleteMany()]);
    await prisma.settings.updateMany({ data: { trackingState: "STOPPED", runStartedAt: null, runAccumulatedSeconds: 0 } });
    void broadcastSnapshot();
    return NextResponse.json({ deleted: true, sessions: sessions.count, heartbeats: heartbeats.count });
  } catch (error) {
    return handleError(error, "data.delete");
  }
}
