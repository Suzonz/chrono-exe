import { NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { handleError, jsonError, parseBody } from "@/lib/api";
import { FALLBACK_CATEGORY, invalidateRulesCache, SYSTEM_CATEGORIES } from "@/lib/categorizer";
import { broadcastSnapshot } from "@/lib/sse";
import { CATEGORY_COLORS, PRODUCTIVITY_LEVELS } from "@/types";

export const dynamic = "force-dynamic";

const nameSchema = z
  .string()
  .trim()
  .min(1)
  .max(32)
  .transform((value) => value.toUpperCase().replace(/\s+/g, "_"))
  .refine((value) => /^[A-Z0-9_.-]+$/.test(value), "Use letters, digits, '_', '-' or '.'");

const colorSchema = z.enum(CATEGORY_COLORS);

const productivitySchema = z.enum(PRODUCTIVITY_LEVELS);
/** null removes the limit. Between 1 minute and 24 hours. */
const limitSchema = z.number().int().min(60).max(86400).nullable();

const postSchema = z.object({
  name: nameSchema,
  color: colorSchema,
  productivity: productivitySchema.default("NEUTRAL"),
  dailyLimitSeconds: limitSchema.default(null)
});
const putSchema = z.object({
  id: z.string().min(1),
  name: nameSchema.optional(),
  color: colorSchema.optional(),
  productivity: productivitySchema.optional(),
  dailyLimitSeconds: limitSchema.optional()
});
const patchSchema = z.object({ orderedIds: z.array(z.string().min(1)).min(1) });
const deleteSchema = z.object({ id: z.string().min(1) });

const isSystem = (name: string) => (SYSTEM_CATEGORIES as readonly string[]).includes(name);

export async function GET(): Promise<NextResponse> {
  try {
    const categories = await prisma.category.findMany({ orderBy: [{ order: "asc" }, { createdAt: "asc" }] });
    return NextResponse.json(categories);
  } catch (error) {
    return handleError(error, "categories.get");
  }
}

export async function POST(request: Request): Promise<NextResponse> {
  const parsed = await parseBody(request, postSchema);
  if (!parsed.ok) return parsed.response;

  try {
    const last = await prisma.category.findFirst({ orderBy: { order: "desc" } });
    const category = await prisma.category.create({
      data: { ...parsed.data, order: (last?.order ?? -1) + 1 }
    });
    return NextResponse.json(category, { status: 201 });
  } catch (error) {
    return handleError(error, "categories.post");
  }
}

export async function PUT(request: Request): Promise<NextResponse> {
  const parsed = await parseBody(request, putSchema);
  if (!parsed.ok) return parsed.response;

  try {
    const existing = await prisma.category.findUnique({ where: { id: parsed.data.id } });
    if (!existing) return jsonError("NOT_FOUND", "Category not found", 404);
    if (parsed.data.name && parsed.data.name !== existing.name && isSystem(existing.name)) {
      return jsonError("SYSTEM_CATEGORY", `${existing.name} is a system category and cannot be renamed`, 400);
    }

    const category = await prisma.category.update({
      where: { id: parsed.data.id },
      data: {
        name: parsed.data.name,
        color: parsed.data.color,
        productivity: parsed.data.productivity,
        dailyLimitSeconds: parsed.data.dailyLimitSeconds
      }
    });
    invalidateRulesCache();
    void broadcastSnapshot();
    return NextResponse.json(category);
  } catch (error) {
    return handleError(error, "categories.put");
  }
}

/** Reorders categories: `{ orderedIds }` lists every id in its new position. */
export async function PATCH(request: Request): Promise<NextResponse> {
  const parsed = await parseBody(request, patchSchema);
  if (!parsed.ok) return parsed.response;

  try {
    await prisma.$transaction(
      parsed.data.orderedIds.map((id, order) => prisma.category.update({ where: { id }, data: { order } }))
    );
    invalidateRulesCache();
    const categories = await prisma.category.findMany({ orderBy: [{ order: "asc" }, { createdAt: "asc" }] });
    return NextResponse.json(categories);
  } catch (error) {
    return handleError(error, "categories.patch");
  }
}

/** Deletes a custom category; its sessions and heartbeats are reassigned to OTHER. */
export async function DELETE(request: Request): Promise<NextResponse> {
  const parsed = await parseBody(request, deleteSchema);
  if (!parsed.ok) return parsed.response;

  try {
    const target = await prisma.category.findUnique({ where: { id: parsed.data.id } });
    if (!target) return jsonError("NOT_FOUND", "Category not found", 404);
    if (target.isDefault) {
      return jsonError("DEFAULT_CATEGORY", `${target.name} is a default category and cannot be deleted`, 400);
    }

    const other = await prisma.category.findUnique({ where: { name: FALLBACK_CATEGORY } });
    if (!other) return jsonError("MISSING_OTHER_CATEGORY", "OTHER category missing, run the seed", 500);

    await prisma.$transaction([
      prisma.session.updateMany({ where: { categoryId: target.id }, data: { categoryId: other.id } }),
      prisma.heartbeat.updateMany({ where: { categoryId: target.id }, data: { categoryId: other.id } }),
      prisma.rule.deleteMany({ where: { categoryId: target.id } }),
      prisma.category.delete({ where: { id: target.id } })
    ]);

    invalidateRulesCache();
    void broadcastSnapshot();
    return NextResponse.json({ deleted: true });
  } catch (error) {
    return handleError(error, "categories.delete");
  }
}
