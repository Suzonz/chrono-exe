"use client";

import type { TimelineBlock } from "@/types";
import { Widget } from "@/components/ui/Widget";
import { TimelineStrip } from "@/components/ui/TimelineStrip";
import { CategoryBadge } from "@/components/ui/CategoryBadge";
import { dayRange } from "@/lib/time";
import { OUTSIDE_CHROME } from "@/lib/scope";

/** 24h strip of the day: what you did, hour by hour. */
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
  const blocks = includeOutside ? allBlocks : allBlocks.filter((block) => block.category.name !== OUTSIDE_CHROME);
  // Compact (TODAY): zoom on the active hours instead of 24h of mostly empty time.
  const dayStart = dayRange(date).start.getTime();
  const HOUR = 3600000;
  let first = 0;
  let last = 24;
  if (compact && blocks.length > 0) {
    const starts = blocks.map((block) => new Date(block.startTime).getTime());
    const ends = blocks.map((block) => new Date(block.endTime).getTime()).concat(nowMs !== undefined ? [nowMs] : []);
    first = Math.max(0, Math.floor((Math.min(...starts) - dayStart) / HOUR));
    last = Math.min(24, Math.ceil((Math.max(...ends) - dayStart) / HOUR));
    if (last - first < 4) last = Math.min(24, first + 4);
    // Even span above 12h, so 2-hour ticks land on whole hours.
    if (last - first > 12 && (last - first) % 2 === 1) last < 24 ? (last += 1) : (first -= 1);
  }
  const hours = last - first;
  const windowStart = dayStart + first * HOUR;
  const ticks = hours <= 12 ? hours : Math.ceil(hours / 2);
  const legend = new Map<string, TimelineBlock["category"]>();
  for (const block of blocks) if (!block.isIdle) legend.set(block.category.id, block.category);

  return (
    <Widget
      title="YOUR DAY, HOUR BY HOUR"
      hint="Each colored block is an activity. Hover one to see what it was. Gaps mean nothing was recorded."
      compact={compact}
      className={compact ? "h-full" : ""}
    >
      <TimelineStrip blocks={blocks} windowStart={windowStart} windowSeconds={hours * 3600} nowMs={nowMs} ticks={ticks} heightClass="h-12" fill={compact} />
      <div className="mt-sm flex flex-wrap gap-x-lg gap-y-xs">
        {Array.from(legend.values()).map((category) => (
          <CategoryBadge key={category.id} category={category} size="ui-small" />
        ))}
        {blocks.some((block) => block.isIdle) ? <CategoryBadge category={{ name: "AWAY", color: "slate" }} size="ui-small" /> : null}
      </div>
    </Widget>
  );
}
