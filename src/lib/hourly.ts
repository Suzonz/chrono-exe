/**
 * Hour-by-hour buckets of a day: for each hour, the active seconds per
 * category and the away time. Pure, so it is unit-tested.
 */
import type { CategoryRef, TimelineBlock } from "@/types";

const HOUR_MS = 3600 * 1000;

type BucketCategory = Pick<CategoryRef, "id" | "name" | "color">;

export interface HourBucket {
  /** 0-23, local time. */
  hour: number;
  activeSeconds: number;
  idleSeconds: number;
  /** Same order in every bucket: the day's biggest category first. */
  parts: { category: BucketCategory; seconds: number }[];
}

/**
 * From the first hour with activity to the last one (or the current hour, for
 * today). Hours in between with nothing recorded are kept, empty.
 */
export function hourlyBuckets(blocks: TimelineBlock[], dayStartMs: number, nowMs?: number): HourBucket[] {
  const dayEnd = dayStartMs + 24 * HOUR_MS;
  const spans = blocks
    .map((block) => ({
      block,
      start: Math.max(new Date(block.startTime).getTime(), dayStartMs),
      end: Math.min(new Date(block.endTime).getTime(), dayEnd, nowMs ?? Infinity)
    }))
    .filter((span) => span.end > span.start);
  if (spans.length === 0) return [];

  let first = Math.floor((Math.min(...spans.map((span) => span.start)) - dayStartMs) / HOUR_MS);
  let last = Math.ceil((Math.max(...spans.map((span) => span.end)) - dayStartMs) / HOUR_MS);
  if (nowMs !== undefined && nowMs >= dayStartMs && nowMs < dayEnd) last = Math.max(last, Math.floor((nowMs - dayStartMs) / HOUR_MS) + 1);
  first = Math.max(0, first);
  last = Math.min(24, Math.max(last, first + 1));

  // Stable stacking order: biggest category of the day at the bottom.
  const totals = new Map<string, { category: BucketCategory; seconds: number }>();
  for (const span of spans) {
    if (span.block.isIdle) continue;
    const entry = totals.get(span.block.category.id) ?? { category: span.block.category, seconds: 0 };
    entry.seconds += (span.end - span.start) / 1000;
    totals.set(span.block.category.id, entry);
  }
  const order = Array.from(totals.values()).sort((a, b) => b.seconds - a.seconds);

  const buckets: HourBucket[] = [];
  for (let hour = first; hour < last; hour += 1) {
    const from = dayStartMs + hour * HOUR_MS;
    const to = from + HOUR_MS;
    const perCategory = new Map<string, number>();
    let idleSeconds = 0;
    for (const span of spans) {
      const overlap = (Math.min(span.end, to) - Math.max(span.start, from)) / 1000;
      if (overlap <= 0) continue;
      if (span.block.isIdle) idleSeconds += overlap;
      else perCategory.set(span.block.category.id, (perCategory.get(span.block.category.id) ?? 0) + overlap);
    }
    const parts = order
      .filter((entry) => (perCategory.get(entry.category.id) ?? 0) > 0)
      .map((entry) => ({ category: entry.category, seconds: Math.round(perCategory.get(entry.category.id) ?? 0) }));
    buckets.push({
      hour,
      activeSeconds: parts.reduce((sum, part) => sum + part.seconds, 0),
      idleSeconds: Math.round(idleSeconds),
      parts
    });
  }
  return buckets;
}
