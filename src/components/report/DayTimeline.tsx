"use client";

import { useState } from "react";
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
  compact = false
}: {
  /** Fills its grid cell (TODAY). */
  compact?: boolean;
  date: string;
  blocks: TimelineBlock[];
  nowMs?: number;
  /** false: Chrome only, time in other apps is left out. */
  includeOutside?: boolean;
}) {
  const [hovered, setHovered] = useState<number | null>(null);
  const blocks = includeOutside ? allBlocks : allBlocks.filter((block) => block.category.name !== OUTSIDE_CHROME);
  const buckets = hourlyBuckets(blocks, dayRange(date).start.getTime(), nowMs);
  const currentHour = nowMs !== undefined && date === dayKeyOf(nowMs) ? new Date(nowMs).getHours() : null;
  const hoveredBucket = buckets.find((bucket) => bucket.hour === hovered) ?? null;

  const legend = new Map<string, TimelineBlock["category"]>();
  for (const bucket of buckets) for (const part of bucket.parts) legend.set(part.category.id, part.category as TimelineBlock["category"]);

  return (
    <Widget
      title="YOUR DAY, HOUR BY HOUR"
      hint="One column per hour: its height is how many minutes you were active in that hour (out of 60), colored by category. Hover a column for details."
      compact={compact}
      className={compact ? "h-full" : ""}
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
