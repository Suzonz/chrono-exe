/**
 * @file src/lib/categoryRef.ts
 * @description Converts a Category row into the lightweight reference used in payloads.
 */

import type { CategoryRef, Productivity } from "@/types";
import { PRODUCTIVITY_LEVELS } from "@/types";
import { isCategoryColor } from "@/lib/palette";

export function asProductivity(value: string): Productivity {
  return (PRODUCTIVITY_LEVELS as readonly string[]).includes(value) ? (value as Productivity) : "NEUTRAL";
}

export function toCategoryRef(row: {
  id: string;
  name: string;
  color: string;
  productivity: string;
  dailyLimitSeconds: number | null;
}): CategoryRef {
  return {
    id: row.id,
    name: row.name,
    color: isCategoryColor(row.color) ? row.color : "slate",
    productivity: asProductivity(row.productivity),
    dailyLimitSeconds: row.dailyLimitSeconds
  };
}
