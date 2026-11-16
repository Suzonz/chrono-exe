import { NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { handleError, parseBody } from "@/lib/api";
import { invalidateIgnoreCache } from "@/lib/ignoreList";

export const dynamic = "force-dynamic";

const postSchema = z.object({ pattern: z.string().trim().min(1).max(256) });
const deleteSchema = z.object({ id: z.string().min(1) });

export async function GET(): Promise<NextResponse> {
  try {
    const patterns = await prisma.ignorePattern.findMany({ orderBy: { createdAt: "asc" } });
    return NextResponse.json(patterns);
  } catch (error) {
    return handleError(error, "ignore.get");
  }
}

export async function POST(request: Request): Promise<NextResponse> {
  const parsed = await parseBody(request, postSchema);
  if (!parsed.ok) return parsed.response;

  try {
    const pattern = await prisma.ignorePattern.create({ data: { pattern: parsed.data.pattern } });
    invalidateIgnoreCache();
    return NextResponse.json(pattern, { status: 201 });
  } catch (error) {
    return handleError(error, "ignore.post");
  }
}

export async function DELETE(request: Request): Promise<NextResponse> {
  const parsed = await parseBody(request, deleteSchema);
  if (!parsed.ok) return parsed.response;

  try {
    await prisma.ignorePattern.delete({ where: { id: parsed.data.id } });
    invalidateIgnoreCache();
    return NextResponse.json({ deleted: true });
  } catch (error) {
    return handleError(error, "ignore.delete");
  }
}
