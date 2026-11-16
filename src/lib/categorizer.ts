/**
 * @file src/lib/categorizer.ts
 * @description URL categorization engine: ordered rule evaluation (first match wins) with cache.
 */

import type { CategoryRef } from "@/types";
import prisma from "@/lib/prisma";
import { matchesUrl } from "@/lib/glob";
import { toCategoryRef } from "@/lib/categoryRef";

export const IDLE_CATEGORY = "IDLE";
export const FALLBACK_CATEGORY = "OTHER";
/** Time spent in other apps while Chrome is in the background. */
export const OUTSIDE_CATEGORY = "OUTSIDE_CHROME";
/** Categories the engine depends on by name: they cannot be renamed or deleted. */
export const SYSTEM_CATEGORIES = [IDLE_CATEGORY, FALLBACK_CATEGORY, OUTSIDE_CATEGORY] as const;

/** Defaults used when a system category has to be created on the fly. */
const SYSTEM_DEFAULTS: Record<string, { color: string; order: number }> = {
  [IDLE_CATEGORY]: { color: "slate", order: 98 },
  [FALLBACK_CATEGORY]: { color: "indigo", order: 97 },
  [OUTSIDE_CATEGORY]: { color: "teal", order: 96 }
};

type CachedRule = { pattern: string; category: CategoryRef };

const globalCache = globalThis as unknown as {
  __chronoRules?: CachedRule[] | null;
};

const toRef = toCategoryRef;

async function getRules(): Promise<CachedRule[]> {
  if (globalCache.__chronoRules) {
    return globalCache.__chronoRules;
  }
  const rules = await prisma.rule.findMany({
    include: { category: true },
    orderBy: [{ order: "asc" }, { createdAt: "asc" }]
  });
  globalCache.__chronoRules = rules.map((rule) => ({ pattern: rule.pattern, category: toRef(rule.category) }));
  return globalCache.__chronoRules;
}

export async function getCategoryByName(name: string): Promise<CategoryRef> {
  const category = await prisma.category.upsert({
    where: { name },
    update: {},
    create: { name, color: SYSTEM_DEFAULTS[name]?.color ?? "slate", isDefault: true, order: SYSTEM_DEFAULTS[name]?.order ?? 99 }
  });
  return toRef(category);
}

export async function categorize(url: string): Promise<CategoryRef> {
  const rules = await getRules();
  const match = rules.find((rule) => matchesUrl(url, rule.pattern));
  return match ? match.category : getCategoryByName(FALLBACK_CATEGORY);
}

export function invalidateRulesCache(): void {
  globalCache.__chronoRules = null;
}
