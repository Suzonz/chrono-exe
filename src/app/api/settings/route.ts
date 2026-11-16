import { NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { handleError, parseBody } from "@/lib/api";
import { getSettings } from "@/lib/dashboard";
import { broadcastSnapshot } from "@/lib/sse";

export const dynamic = "force-dynamic";

const putSchema = z
  .object({
    dailyGoalSeconds: z.number().int().min(60).max(86400).optional(),
    inactivityDelaySeconds: z.number().int().min(60).max(1800).optional()
  })
  .refine((data) => Object.keys(data).length > 0, "Nothing to update");

export async function GET(): Promise<NextResponse> {
  try {
    return NextResponse.json(await getSettings());
  } catch (error) {
    return handleError(error, "settings.get");
  }
}

export async function PUT(request: Request): Promise<NextResponse> {
  const parsed = await parseBody(request, putSchema);
  if (!parsed.ok) return parsed.response;

  try {
    const existing = await getSettings();
    const settings = await prisma.settings.update({ where: { id: existing.id }, data: parsed.data });
    void broadcastSnapshot();
    return NextResponse.json(settings);
  } catch (error) {
    return handleError(error, "settings.put");
  }
}
