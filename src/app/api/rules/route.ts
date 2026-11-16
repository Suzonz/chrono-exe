import { NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { handleError, parseBody } from "@/lib/api";
import { invalidateRulesCache } from "@/lib/categorizer";

export const dynamic = "force-dynamic";

const patternSchema = z.string().trim().min(1).max(256);

const postSchema = z.object({ pattern: patternSchema, categoryId: z.string().min(1) });
const putSchema = z.object({
  id: z.string().min(1),
  pattern: patternSchema.optional(),
  categoryId: z.string().min(1).optional()
});
const patchSchema = z.object({ orderedIds: z.array(z.string().min(1)).min(1) });
const deleteSchema = z.object({ id: z.string().min(1) });

const ordered = () => prisma.rule.findMany({ orderBy: [{ order: "asc" }, { createdAt: "asc" }] });

export async function GET(): Promise<NextResponse> {
  try {
    return NextResponse.json(await ordered());
  } catch (error) {
    return handleError(error, "rules.get");
  }
}

export async function POST(request: Request): Promise<NextResponse> {
  const parsed = await parseBody(request, postSchema);
  if (!parsed.ok) return parsed.response;

  try {
    const last = await prisma.rule.findFirst({ orderBy: { order: "desc" } });
    const rule = await prisma.rule.create({
      data: { pattern: parsed.data.pattern, categoryId: parsed.data.categoryId, order: (last?.order ?? -1) + 1 }
    });
    invalidateRulesCache();
    return NextResponse.json(rule, { status: 201 });
  } catch (error) {
    return handleError(error, "rules.post");
  }
}

export async function PUT(request: Request): Promise<NextResponse> {
  const parsed = await parseBody(request, putSchema);
  if (!parsed.ok) return parsed.response;

  try {
    const rule = await prisma.rule.update({
      where: { id: parsed.data.id },
      data: { pattern: parsed.data.pattern, categoryId: parsed.data.categoryId }
    });
    invalidateRulesCache();
    return NextResponse.json(rule);
  } catch (error) {
    return handleError(error, "rules.put");
  }
}

/** Reorders rules (evaluation order): `{ orderedIds }` lists every id in its new position. */
export async function PATCH(request: Request): Promise<NextResponse> {
  const parsed = await parseBody(request, patchSchema);
  if (!parsed.ok) return parsed.response;

  try {
    await prisma.$transaction(
      parsed.data.orderedIds.map((id, order) => prisma.rule.update({ where: { id }, data: { order } }))
    );
    invalidateRulesCache();
    return NextResponse.json(await ordered());
  } catch (error) {
    return handleError(error, "rules.patch");
  }
}

export async function DELETE(request: Request): Promise<NextResponse> {
  const parsed = await parseBody(request, deleteSchema);
  if (!parsed.ok) return parsed.response;

  try {
    await prisma.rule.delete({ where: { id: parsed.data.id } });
    invalidateRulesCache();
    return NextResponse.json({ deleted: true });
  } catch (error) {
    return handleError(error, "rules.delete");
  }
}
