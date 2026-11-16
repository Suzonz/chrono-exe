/**
 * @file src/lib/api.ts
 * @description Shared helpers for API route handlers: JSON parsing, typed errors, Prisma error mapping.
 */

import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import type { z, ZodTypeAny } from "zod";
import type { ApiError } from "@/types";

export function jsonError(code: string, message: string, status: number, details?: unknown): NextResponse<ApiError> {
  return NextResponse.json({ code, message, ...(details === undefined ? {} : { details }) }, { status });
}

export function isDbUnreachable(error: unknown): boolean {
  if (error instanceof Prisma.PrismaClientInitializationError) return true;
  if (error instanceof Prisma.PrismaClientRustPanicError) return true;
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    return ["P1001", "P1002", "P1008", "P1017"].includes(error.code);
  }
  if (error instanceof Prisma.PrismaClientUnknownRequestError) {
    return /connect|connection|ECONNREFUSED|closed/i.test(error.message);
  }
  return false;
}

/** Maps any thrown error to a meaningful HTTP response. */
export function handleError(error: unknown, context: string): NextResponse<ApiError> {
  if (isDbUnreachable(error)) {
    return jsonError("DB_UNREACHABLE", "Database unreachable", 503);
  }
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === "P2002") return jsonError("CONFLICT", "A record with this value already exists", 409);
    if (error.code === "P2025") return jsonError("NOT_FOUND", "Record not found", 404);
    if (error.code === "P2003") return jsonError("INVALID_REFERENCE", "Referenced record does not exist", 400);
  }
  console.error(`[api] ${context} failed`, error);
  return jsonError("INTERNAL_ERROR", "Unexpected server error", 500);
}

type ParseResult<T> = { ok: true; data: T } | { ok: false; response: NextResponse<ApiError> };

/** Reads and validates a JSON body. Never throws. */
export async function parseBody<S extends ZodTypeAny>(request: Request, schema: S): Promise<ParseResult<z.infer<S>>> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return { ok: false, response: jsonError("INVALID_JSON", "Request body must be valid JSON", 400) };
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return {
      ok: false,
      response: jsonError("VALIDATION_ERROR", "Invalid request payload", 400, parsed.error.flatten())
    };
  }
  return { ok: true, data: parsed.data };
}

/** Validates query-string parameters. */
export function parseQuery<S extends ZodTypeAny>(request: Request, schema: S): ParseResult<z.infer<S>> {
  const { searchParams } = new URL(request.url);
  const raw = Object.fromEntries(searchParams.entries());
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      response: jsonError("VALIDATION_ERROR", "Invalid query parameters", 400, parsed.error.flatten())
    };
  }
  return { ok: true, data: parsed.data };
}
