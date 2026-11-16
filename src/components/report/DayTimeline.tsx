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
  includeOutside = true
}: {
  date: string;
  blocks: TimelineBlock[];
  nowMs?: number;
  /** false: Chrome only, time in other apps is left out. */
  includeOutside?: boolean;
}) {
  const blocks = includeOutside ? allBlocks : allBlocks.filter((block) => block.category.name !== OUTSIDE_CHROME);
  const legend = new Map<string, TimelineBlock["category"]>();
  for (const block of blocks) if (!block.isIdle) legend.set(block.category.id, block.category);

  return (
    <Widget title="YOUR DAY, HOUR BY HOUR" hint="Each colored block is an activity. Hover one to see what it was. Gaps mean nothing was recorded.">
      <TimelineStrip blocks={blocks} windowStart={dayRange(date).start.getTime()} windowSeconds={86400} nowMs={nowMs} ticks={6} heightClass="h-12" />
      <div className="mt-sm flex flex-wrap gap-x-lg gap-y-xs">
        {Array.from(legend.values()).map((category) => (
          <CategoryBadge key={category.id} category={category} size="ui-small" />
        ))}
        {blocks.some((block) => block.isIdle) ? <CategoryBadge category={{ name: "AWAY", color: "slate" }} size="ui-small" /> : null}
      </div>
    </Widget>
  );
}
