"use client";

import { useEffect, useState } from "react";
import type { TimelineBlock } from "@/types";
import { Widget } from "@/components/ui/Widget";
import { CategoryBadge } from "@/components/ui/CategoryBadge";
import { Empty } from "@/components/ui/States";
import { colorHex } from "@/lib/palette";
import { dayRange, formatCompact } from "@/lib/time";
import { OUTSIDE_CHROME } from "@/lib/scope";
import { hourlyBuckets, type HourBucket } from "@/lib/hourly";

const AWAY_COLOR = "#4b5563";
const pad = (hour: number) => String(hour).padStart(2, "0");

function describe(bucket: HourBucket): string {
  const parts = bucket.parts.map((part) => `${part.category.name} ${formatCompact(part.seconds).toLowerCase()}`).join(", ");
  const away = bucket.idleSeconds >= 60 ? ` · away ${formatCompact(bucket.idleSeconds).toLowerCase()}` : "";
  if (bucket.activeSeconds < 60 && !away) return `${pad(bucket.hour)}:00-${pad(bucket.hour + 1)}:00 · nothing recorded`;
  return `${pad(bucket.hour)}:00-${pad(bucket.hour + 1)}:00 · ${formatCompact(bucket.activeSeconds).toLowerCase()} active${parts ? ` · ${parts}` : ""}${away}`;
}

/**
 * One column per hour: its height is the active minutes in that hour (out of
 * 60), split by category. Drawn in 5-minute pixel blocks.
 */
export function DayTimeline({
  date,
  blocks: allBlocks,
  nowMs,
  includeOutside = true,
  compact = false,
  fromMs,
  title = "YOUR DAY, HOUR BY HOUR"
}: {
  /** Only show what happened after this moment (the current session). */
  fromMs?: number;
  title?: string;
  /** Fills its grid cell (TODAY). */
  compact?: boolean;
  date: string;
  blocks: TimelineBlock[];
  nowMs?: number;
  /** false: Chrome only, time in other apps is left out. */
  includeOutside?: boolean;
}) {
  const [hovered, setHovered] = useState<number | null>(null);
  const scoped = includeOutside ? allBlocks : allBlocks.filter((block) => block.category.name !== OUTSIDE_CHROME);
  const blocks = fromMs === undefined ? scoped : clipBlocks(scoped, fromMs);
  const dayStart = dayRange(date).start.getTime();
  const currentHour = nowMs !== undefined && date === dayKeyOf(nowMs) ? new Date(nowMs).getHours() : null;

  // A window of hours, scrolled with the arrows. By default it ends at the
  // current hour (today) or the last active hour (past days).
  const windowSize = compact ? 8 : 12;
  const natural = hourlyBuckets(blocks, dayStart, nowMs);
  const latestEnd = currentHour !== null ? currentHour + 1 : natural.length > 0 ? natural[natural.length - 1].hour + 1 : 24;
  const [scrolledEnd, setScrolledEnd] = useState<number | null>(null);
  useEffect(() => setScrolledEnd(null), [date]);
  const windowEnd = Math.min(latestEnd, Math.max(Math.min(windowSize, latestEnd), scrolledEnd ?? latestEnd));
  const windowStart = Math.max(0, windowEnd - windowSize);
  const buckets = natural.length === 0 ? [] : hourlyBuckets(blocks, dayStart, nowMs, { from: windowStart, to: windowEnd });
  const step = windowSize / 2;
  const canGoBack = windowStart > 0;
  const canGoForward = windowEnd < latestEnd;
  const navButton =
    "border border-outline-variant px-[6px] py-[1px] text-ui-small text-outline enabled:hover:border-secondary-fixed enabled:hover:text-secondary-fixed disabled:cursor-not-allowed disabled:opacity-30";
  const hoveredBucket = buckets.find((bucket) => bucket.hour === hovered) ?? null;

  const legend = new Map<string, TimelineBlock["category"]>();
  for (const bucket of buckets) for (const part of bucket.parts) legend.set(part.category.id, part.category as TimelineBlock["category"]);

  return (
    <Widget
      title={title}
      hint="One column per hour: its height is how many minutes you were active in that hour (out of 60), colored by category. Hover a column for details."
      compact={compact}
      className={compact ? "h-full" : ""}
      meta={
        natural.length > 0 ? (
          <span className="inline-flex items-center gap-xs normal-case">
            <button type="button" className={navButton} onClick={() => setScrolledEnd(windowEnd - step)} disabled={!canGoBack} aria-label="Earlier hours" title="Earlier hours">
              {"<"}
            </button>
            <span className="min-w-[96px] text-center text-ui-small text-on-surface-variant">
              {pad(windowStart)}:00-{pad(windowEnd)}:00
            </span>
            <button type="button" className={navButton} onClick={() => setScrolledEnd(windowEnd + step)} disabled={!canGoForward} aria-label="Later hours" title="Later hours">
              {">"}
            </button>
            <button
              type="button"
              className={navButton}
              onClick={() => setScrolledEnd(null)}
              disabled={!canGoForward}
              title={currentHour !== null ? "Back to now" : "Back to the end of the day"}
            >
              {currentHour !== null ? "NOW" : "END"}
            </button>
          </span>
        ) : undefined
      }
    >
      {buckets.length === 0 ? (
        <Empty>No activity recorded yet.</Empty>
      ) : (
        <>
          <div className={`flex gap-sm ${compact ? "min-h-[120px] flex-1" : "h-48"}`}>
            {/* Y axis: minutes in the hour. */}
            <div className="flex flex-col justify-between pb-[18px] text-right text-[9px] text-outline" aria-hidden>
              <span>60m</span>
              <span>30m</span>
              <span>0</span>
            </div>
            <div className="flex min-w-0 flex-1 flex-col" onMouseLeave={() => setHovered(null)}>
              <div className="relative flex min-h-0 flex-1 items-end gap-[4px] border-b border-outline-variant" role="img" aria-label="Active minutes per hour">
                <div aria-hidden className="pointer-events-none absolute inset-x-0 top-1/2 border-t border-dashed border-outline-variant/50" />
                {buckets.map((bucket) => {
                  const isNow = bucket.hour === currentHour;
                  const dim = hovered !== null && hovered !== bucket.hour;
                  const total = bucket.activeSeconds + bucket.idleSeconds;
                  return (
                    <div
                      key={bucket.hour}
                      onMouseEnter={() => setHovered(bucket.hour)}
                      className={`relative flex h-full flex-1 cursor-crosshair flex-col justify-end transition-opacity ${dim ? "opacity-40" : ""} ${
                        isNow ? "outline outline-1 outline-dashed outline-secondary-fixed/60" : ""
                      } ${hovered === bucket.hour ? "bg-surface-container-highest" : ""}`}
                    >
                      <div className="flex flex-col-reverse" style={{ height: `${Math.min(100, (total / 3600) * 100)}%` }}>
                        {bucket.parts.map((part) => (
                          <div key={part.category.id} style={{ height: `${(part.seconds / total) * 100}%`, backgroundColor: colorHex(part.category.color) }} />
                        ))}
                        {bucket.idleSeconds > 0 ? (
                          <div
                            style={{
                              height: `${(bucket.idleSeconds / total) * 100}%`,
                              backgroundColor: AWAY_COLOR,
                              backgroundImage: "repeating-linear-gradient(45deg, transparent 0 3px, rgba(0,0,0,0.35) 3px 6px)"
                            }}
                          />
                        ) : null}
                      </div>
                      {/* 5-minute pixel grid over the column. */}
                      <div
                        aria-hidden
                        className="pointer-events-none absolute inset-0"
                        style={{ backgroundImage: "linear-gradient(to top, rgba(21,18,27,0.85) 2px, transparent 2px)", backgroundSize: "100% calc(100% / 12)" }}
                      />
                    </div>
                  );
                })}
              </div>
              <div className="mt-xs flex gap-[4px] text-[9px] text-outline" aria-hidden>
                {buckets.map((bucket) => (
                  <span key={bucket.hour} className={`flex-1 text-center ${bucket.hour === currentHour ? "text-secondary-fixed" : ""}`}>
                    {buckets.length > 14 && bucket.hour % 2 === 1 ? "" : pad(bucket.hour)}
                  </span>
                ))}
              </div>
            </div>
          </div>
          <div className="mt-sm min-h-[20px] font-read text-read-sm text-on-surface-variant" aria-live="polite">
            {hoveredBucket ? `> ${describe(hoveredBucket)}` : "> Hover an hour for details"}
          </div>
          <div className="mt-xs flex flex-wrap gap-x-lg gap-y-xs">
            {Array.from(legend.values()).map((category) => (
              <CategoryBadge key={category.id} category={category} size="ui-small" />
            ))}
            {buckets.some((bucket) => bucket.idleSeconds > 0) ? <CategoryBadge category={{ name: "AWAY", color: "slate" }} size="ui-small" /> : null}
          </div>
        </>
      )}
    </Widget>
  );
}

function dayKeyOf(ms: number): string {
  const date = new Date(ms);
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** Blocks cut at `fromMs`: what happened before it is left out. */
function clipBlocks(blocks: TimelineBlock[], fromMs: number): TimelineBlock[] {
  const from = new Date(fromMs).toISOString();
  return blocks
    .filter((block) => block.isActive || new Date(block.endTime).getTime() > fromMs)
    .map((block) => (new Date(block.startTime).getTime() < fromMs ? { ...block, startTime: from } : block));
}
