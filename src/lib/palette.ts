/**
 * @file src/lib/palette.ts
 * @description Category color palette (16 presets) tuned for the dark terminal background.
 */

import type { CategoryColor } from "@/types";
import { CATEGORY_COLORS } from "@/types";

export const PALETTE: Record<CategoryColor, string> = {
  violet: "#a78bfa",
  cyan: "#22d3ee",
  green: "#4ade80",
  amber: "#fbbf24",
  red: "#f87171",
  pink: "#f472b6",
  orange: "#fb923c",
  teal: "#2dd4bf",
  indigo: "#818cf8",
  lime: "#a3e635",
  yellow: "#fde047",
  rose: "#fb7185",
  sky: "#38bdf8",
  emerald: "#34d399",
  fuchsia: "#e879f9",
  slate: "#64748b"
};

export function colorHex(color: string | null | undefined): string {
  if (color && color in PALETTE) {
    return PALETTE[color as CategoryColor];
  }
  return PALETTE.slate;
}

export function isCategoryColor(value: string): value is CategoryColor {
  return (CATEGORY_COLORS as readonly string[]).includes(value);
}
