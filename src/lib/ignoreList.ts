/**
 * @file src/lib/ignoreList.ts
 * @description Ignore list matcher with in-memory cache and invalidation.
 */

import prisma from "@/lib/prisma";
import { matchesUrl } from "@/lib/glob";

const globalCache = globalThis as unknown as { __chronoIgnore?: string[] | null };

async function getIgnorePatterns(): Promise<string[]> {
  if (globalCache.__chronoIgnore) {
    return globalCache.__chronoIgnore;
  }
  const patterns = await prisma.ignorePattern.findMany({ orderBy: { createdAt: "asc" } });
  globalCache.__chronoIgnore = patterns.map((item) => item.pattern);
  return globalCache.__chronoIgnore;
}

export async function isIgnored(url: string): Promise<boolean> {
  const patterns = await getIgnorePatterns();
  return patterns.some((pattern) => matchesUrl(url, pattern));
}

export function invalidateIgnoreCache(): void {
  globalCache.__chronoIgnore = null;
}
