"use client";

import { useState } from "react";
import type { TimelineBlock } from "@/types";
import { colorHex } from "@/lib/palette";
import { siteLabel } from "@/lib/glob";
import { formatClock, formatCompact } from "@/lib/time";

const IDLE_COLOR = "#4a4455";

function describe(block: TimelineBlock): string {
  const start = new Date(block.startTime);
  const end = new Date(block.endTime);
  const seconds = Math.round((end.getTime() - start.getTime()) / 1000);
  const where = block.host && !block.isIdle ? ` · ${siteLabel(block.host)}` : "";
  return `${block.isIdle ? "AWAY" : block.category.name} · ${formatClock(start)} -> ${block.isActive ? "NOW" : formatClock(end)} · ${formatCompact(seconds)}${where}`;
}

/**
 * Horizontal time strip. Blocks are positioned absolutely inside
 * [windowStart, windowStart + windowSeconds]; empty space is untracked time.
 */
export function TimelineStrip({
  blocks,
  windowStart,
  windowSeconds,
  nowMs,
  heightClass = "h-16",
  ticks = 4,
  interactive = true,
  fill = false
}: {
  /** Grows to the height of its (flex) parent. */
  fill?: boolean;
  blocks: TimelineBlock[];
  windowStart: number;
  windowSeconds: number;
  nowMs?: number;
  heightClass?: string;
  ticks?: number;
  interactive?: boolean;
}) {
  const [hovered, setHovered] = useState<TimelineBlock | null>(null);
  const windowEnd = windowStart + windowSeconds * 1000;
  const toPct = (ms: number) => ((ms - windowStart) / (windowSeconds * 1000)) * 100;

  const visible = blocks.filter(
    (block) => new Date(block.endTime).getTime() > windowStart && new Date(block.startTime).getTime() < windowEnd
  );

  const tickLabels = Array.from({ length: ticks + 1 }, (_, index) => formatClock(new Date(windowStart + (windowSeconds * 1000 * index) / ticks)));
  tickLabels[ticks] = windowSeconds === 86400 ? "24:00" : tickLabels[ticks];

  return (
    <div className={fill ? "flex min-h-0 flex-1 flex-col" : ""}>
      <div
        className={`relative w-full overflow-hidden border border-outline-variant bg-surface-container-lowest ${fill ? "min-h-[64px] flex-1" : heightClass}`}
        // Faint hatching = nothing recorded (blocks paint over it).
        style={{ backgroundImage: "repeating-linear-gradient(135deg, rgba(255,255,255,0.05) 0 2px, transparent 2px 9px)" }}
        role="img"
        aria-label={`Activity timeline, ${visible.length} tracked blocks`}
        onMouseLeave={() => setHovered(null)}
      >
        {Array.from({ length: ticks - 1 }, (_, index) => (
          <div
            key={index}
            aria-hidden
            className="absolute bottom-0 top-0 w-px bg-outline-variant/60"
            style={{ left: `${((index + 1) / ticks) * 100}%` }}
          />
        ))}
        {visible.map((block) => {
          const start = Math.max(new Date(block.startTime).getTime(), windowStart);
          const end = Math.min(new Date(block.endTime).getTime(), windowEnd);
          const left = toPct(start);
          const width = Math.max(toPct(end) - left, 0.15);
          return (
            <div
              key={block.sessionId}
              className={`absolute bottom-0 top-0 ${interactive ? "cursor-crosshair hover:brightness-125" : ""} ${
                hovered?.sessionId === block.sessionId ? "brightness-125" : ""
              }`}
              style={{
                left: `${left}%`,
                width: `${width}%`,
                backgroundColor: block.isIdle ? IDLE_COLOR : colorHex(block.category.color),
                backgroundImage: block.isIdle
                  ? "repeating-linear-gradient(45deg, transparent 0 3px, rgba(0,0,0,0.35) 3px 6px)"
                  : undefined
              }}
              title={interactive ? undefined : describe(block)}
              onMouseEnter={interactive ? () => setHovered(block) : undefined}
            />
          );
        })}
        {nowMs !== undefined && nowMs >= windowStart && nowMs <= windowEnd ? (
          <div aria-hidden className="absolute bottom-0 top-0 w-[2px] bg-secondary-fixed" style={{ left: `${toPct(nowMs)}%` }}>
            <span className="absolute -top-px left-1 text-ui-small text-secondary-fixed">NOW</span>
          </div>
        ) : null}
      </div>
      <div className="mt-xs flex justify-between text-ui-small text-outline" aria-hidden>
        {tickLabels.map((label, index) => (
          <span key={index}>{label}</span>
        ))}
      </div>
      {interactive ? (
        <div className="mt-sm min-h-[20px] font-read text-read-sm text-on-surface-variant" aria-live="polite">
          {hovered ? `> ${describe(hovered)}` : "> Hover a block for details"}
        </div>
      ) : null}
    </div>
  );
}
