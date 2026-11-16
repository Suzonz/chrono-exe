"use client";

import { useMemo, useState, type ReactNode } from "react";
import type { CategoryBreakdown } from "@/types";
import { Widget } from "@/components/ui/Widget";
import { Empty } from "@/components/ui/States";
import { Trend } from "@/components/report/Trend";
import { colorHex } from "@/lib/palette";
import { formatCompact, formatDuration } from "@/lib/time";

type Group = Omit<CategoryBreakdown, "sessions">;

/** Grid of the pixel ring: odd, so the ring has a true center cell. */
const GRID = 29;
const CENTER = GRID / 2;
const OUTER = GRID / 2;
const INNER = 10.2;
/** Cells are drawn slightly smaller than the grid so each pixel stays visible. */
const CELL = 0.86;
const EMPTY_COLOR = "#2a2633";

interface Cell {
  x: number;
  y: number;
  slice: number;
}

/** Ring cells, each assigned to the slice covering its angle (clockwise from 12 o'clock). */
function ringCells(fractions: number[]): Cell[] {
  const bounds: number[] = [];
  let sum = 0;
  for (const fraction of fractions) {
    sum += fraction;
    bounds.push(sum);
  }
  const cells: Cell[] = [];
  for (let y = 0; y < GRID; y += 1) {
    for (let x = 0; x < GRID; x += 1) {
      const dx = x + 0.5 - CENTER;
      const dy = y + 0.5 - CENTER;
      const distance = Math.hypot(dx, dy);
      if (distance < INNER || distance > OUTER) continue;
      const turn = (Math.atan2(dx, -dy) / (2 * Math.PI) + 1) % 1;
      const slice = bounds.findIndex((bound) => turn < bound);
      cells.push({ x, y, slice: slice === -1 ? fractions.length - 1 : slice });
    }
  }
  return cells;
}

/**
 * Pixel-art donut of where the time went, with a legend in percentages.
 * Hovering a slice or a legend row highlights both.
 */
export function TimeRing({
  title = "WHERE YOUR TIME WENT",
  hint,
  groups,
  totalSeconds,
  centerLabel,
  previousSeconds,
  previousLabel,
  idleSeconds,
  showLimits = false,
  live = false,
  fill = false,
  toolbar
}: {
  /** Fills its grid cell: the ring grows with the available height (TODAY). */
  fill?: boolean;
  /** Shown bottom-left, e.g. the INCLUDE OUTSIDE CHROME checkbox. */
  toolbar?: ReactNode;
  /** Ticking total (TODAY): shown as a stopwatch. Otherwise a compact "93h25". */
  live?: boolean;
  title?: string;
  hint: string;
  groups: Group[];
  /** Shown in the center: can tick live, while slices refresh with the report. */
  totalSeconds: number;
  centerLabel: string;
  previousSeconds: number;
  previousLabel: string;
  idleSeconds?: number;
  showLimits?: boolean;
}) {
  const [hovered, setHovered] = useState<number | null>(null);
  const sum = groups.reduce((total, group) => total + group.totalSeconds, 0);
  const fractions = useMemo(() => (sum > 0 ? groups.map((group) => group.totalSeconds / sum) : []), [groups, sum]);
  const cells = useMemo(() => ringCells(fractions), [fractions]);

  const slices = groups.map((group, index) => ({
    group,
    index,
    color: colorHex(group.category.color),
    cells: cells.filter((cell) => cell.slice === index)
  }));

  const hoveredGroup = hovered !== null ? groups[hovered] : null;

  return (
    <Widget title={title} hint={hint} compact={fill} className={fill ? "h-full" : ""}>
      <div className={fill ? "flex min-h-0 flex-1 items-center gap-xl" : "flex flex-col items-center gap-lg sm:flex-row sm:items-center"}>
        <div
          className={fill ? "relative aspect-square h-full max-h-[460px] min-h-[180px] shrink-0" : "relative w-[220px] shrink-0 sm:w-[240px]"}
          onMouseLeave={() => setHovered(null)}
        >
          <svg viewBox={`0 0 ${GRID} ${GRID}`} shapeRendering="crispEdges" className={fill ? "block h-full w-full" : "block h-auto w-full"} role="img" aria-label="Share of time per category">
            {sum === 0
              ? ringCells([1]).map((cell) => <rect key={`${cell.x}-${cell.y}`} x={cell.x} y={cell.y} width={CELL} height={CELL} fill={EMPTY_COLOR} />)
              : slices.map((slice) => (
                  <g
                    key={slice.group.category.id}
                    fill={slice.color}
                    opacity={hovered === null || hovered === slice.index ? 1 : 0.25}
                    onMouseEnter={() => setHovered(slice.index)}
                    className="cursor-pointer transition-opacity duration-100"
                  >
                    <title>{`${slice.group.category.name} ${Math.round(slice.group.percentage)}% · ${formatCompact(slice.group.totalSeconds)}`}</title>
                    {slice.cells.map((cell) => (
                      <rect key={`${cell.x}-${cell.y}`} x={cell.x} y={cell.y} width={CELL} height={CELL} />
                    ))}
                  </g>
                ))}
          </svg>
          {/* Center: total, or the hovered category. */}
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
            {hoveredGroup ? (
              <>
                <span className={`${fill ? "text-[28px]" : "text-[20px]"} leading-none`} style={{ color: colorHex(hoveredGroup.category.color) }}>
                  {Math.round(hoveredGroup.percentage)}%
                </span>
                <span className="mt-xs max-w-[110px] truncate text-ui-small text-on-surface-variant">{hoveredGroup.category.name}</span>
                <span className="font-read text-read-sm text-outline">{formatCompact(hoveredGroup.totalSeconds).toLowerCase()}</span>
              </>
            ) : (
              <>
                <span className={`${fill ? "text-[22px]" : "text-[15px]"} leading-none text-on-background`}>{live ? formatDuration(totalSeconds) : formatCompact(totalSeconds)}</span>
                <span className="mt-sm text-ui-small text-outline">{centerLabel}</span>
              </>
            )}
          </div>
        </div>

        <div className={fill ? "min-w-0 max-w-[520px] flex-1" : "w-full min-w-0"}>
          {groups.length === 0 ? (
            <Empty>No activity recorded.</Empty>
          ) : (
            <ul className={fill ? "space-y-xs" : "space-y-[2px]"} onMouseLeave={() => setHovered(null)}>
              {slices.map((slice) => {
                const limit = showLimits ? slice.group.category.dailyLimitSeconds : null;
                const over = limit !== null && slice.group.totalSeconds >= limit;
                const dim = hovered !== null && hovered !== slice.index;
                return (
                  <li
                    key={slice.group.category.id}
                    onMouseEnter={() => setHovered(slice.index)}
                    className={`grid grid-cols-[12px_minmax(0,1fr)_auto_auto] items-center gap-x-sm px-xs py-[2px] transition-opacity ${
                      hovered === slice.index ? "bg-surface-container-highest" : ""
                    } ${dim ? "opacity-40" : ""}`}
                  >
                    <span aria-hidden className="h-3 w-3" style={{ backgroundColor: slice.color }} />
                    <span className="min-w-0">
                      <span className="block truncate text-ui-small" style={{ color: slice.color }}>
                        {slice.group.category.name}
                      </span>
                      {limit !== null ? (
                        <span className={`block font-read text-read-sm leading-tight ${over ? "text-error" : "text-outline"}`}>
                          {over ? `! limit ${formatCompact(limit).toLowerCase()} reached` : `limit ${formatCompact(limit).toLowerCase()} / day`}
                        </span>
                      ) : null}
                    </span>
                    <span className="text-right text-ui-small text-on-background">{Math.round(slice.group.percentage)}%</span>
                    <span className="min-w-[52px] whitespace-nowrap text-right font-read text-read text-outline">{formatCompact(slice.group.totalSeconds).toLowerCase()}</span>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>

      <div className="mt-md flex shrink-0 flex-wrap items-center justify-between gap-x-lg gap-y-sm border-t border-outline-variant pt-sm">
        {toolbar}
        <div className="ml-auto flex flex-wrap items-center gap-x-lg gap-y-xs">
          <Trend current={totalSeconds} previous={previousSeconds} label={previousLabel} />
          {idleSeconds !== undefined ? (
            <span className="font-read text-read-sm text-outline">Away from keyboard: {formatCompact(idleSeconds).toLowerCase()} (not counted)</span>
          ) : null}
        </div>
      </div>
    </Widget>
  );
}
