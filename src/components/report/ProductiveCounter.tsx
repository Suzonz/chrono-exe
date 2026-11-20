"use client";

import { useEffect, useRef, useState } from "react";
import { apiFetch, toApiError } from "@/hooks/useApi";
import { Widget } from "@/components/ui/Widget";
import { PixelIcon } from "@/components/ui/PixelIcon";
import { SegmentedBar } from "@/components/ui/SegmentedBar";
import { formatCompact, formatDuration } from "@/lib/time";

const STEP_SECONDS = 15 * 60;
const MIN_GOAL = 15 * 60;
const MAX_GOAL = 12 * 3600;
/** Several clicks in a row are saved once. */
const SAVE_DELAY_MS = 600;

const stepButton =
  "grid h-9 w-9 shrink-0 place-items-center border-2 border-primary-container bg-surface-container-lowest text-primary shadow-[3px_3px_0_0_#000] transition-[transform,box-shadow] duration-75 enabled:hover:bg-primary-container enabled:hover:text-white enabled:active:translate-x-[3px] enabled:active:translate-y-[3px] enabled:active:shadow-none disabled:cursor-not-allowed disabled:opacity-25";

/**
 * Live productive time against the daily goal, set right here with the - / +
 * buttons (15 min steps, saved automatically). The big number can show the
 * current session while the bar and "to go" always follow the whole day.
 */
export function ProductiveCounter({
  productiveSeconds,
  dayProductiveSeconds = productiveSeconds,
  sessionOnly = false,
  goalSeconds,
  running
}: {
  productiveSeconds: number;
  /** Productive time of the whole day, for the goal (defaults to productiveSeconds). */
  dayProductiveSeconds?: number;
  /** The big number describes the current session. */
  sessionOnly?: boolean;
  goalSeconds: number;
  running: boolean;
}) {
  // Local goal while clicking; the server value takes over once saved.
  const [draft, setDraft] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const timer = useRef<number | null>(null);
  const goal = draft ?? goalSeconds;

  useEffect(() => {
    if (draft !== null && draft === goalSeconds) setDraft(null);
  }, [draft, goalSeconds]);

  useEffect(
    () => () => {
      if (timer.current !== null) window.clearTimeout(timer.current);
    },
    []
  );

  const change = (delta: number) => {
    const next = Math.min(MAX_GOAL, Math.max(MIN_GOAL, goal + delta));
    setDraft(next);
    setError(null);
    if (timer.current !== null) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => {
      apiFetch("/api/settings", { method: "PUT", body: JSON.stringify({ dailyGoalSeconds: next }) }).catch((err: unknown) => {
        setDraft(null);
        setError(toApiError(err).message);
      });
    }, SAVE_DELAY_MS);
  };

  const pct = goal > 0 ? Math.min(100, (dayProductiveSeconds / goal) * 100) : 0;
  const reached = dayProductiveSeconds >= goal;
  const left = Math.max(0, goal - dayProductiveSeconds);

  return (
    <Widget
      title="PRODUCTIVE TIME"
      hint={
        sessionOnly
          ? "Time spent this session on categories marked productive (choose them in Settings). The bar and the goal count the whole day: set it with - and +."
          : "Time spent today on categories marked productive (choose them in Settings). Set your daily goal with - and +."
      }
      meta={<span className={reached ? "text-secondary-fixed" : ""}>{reached ? "GOAL REACHED!" : `${Math.round(pct)}%`}</span>}
      compact
      className="h-full"
    >
      <div className="flex flex-wrap items-baseline gap-x-md gap-y-xs">
        <span className={`text-[30px] leading-none ${reached ? "text-secondary-fixed" : running ? "text-primary" : "text-on-background"}`}>
          {formatDuration(productiveSeconds)}
        </span>
        <span className="font-read text-read-sm text-on-surface-variant">{reached ? "Goal reached!" : `${formatCompact(left).toLowerCase()} to go${sessionOnly ? " today" : ""}`}</span>
      </div>

      <div className="mt-sm">
        <SegmentedBar value={pct} total={20} heightClass="h-3" color={reached ? "#15ffd1" : "#7c3aed"} label="Progress towards the productive goal" />
      </div>

      <div className="mt-auto flex items-center gap-sm pt-sm">
        <div className="flex items-center gap-sm">
          <button type="button" className={stepButton} onClick={() => change(-STEP_SECONDS)} disabled={goal <= MIN_GOAL} aria-label="Lower the goal by 15 minutes" title="-15 min">
            <PixelIcon name="minus" size={14} />
          </button>
          <div className="min-w-[72px] text-center">
            <div className="text-[9px] text-outline">GOAL</div>
            <div className="mt-[2px] text-ui-small text-on-background" aria-live="polite">
              {formatCompact(goal).toLowerCase()}
            </div>
          </div>
          <button type="button" className={stepButton} onClick={() => change(STEP_SECONDS)} disabled={goal >= MAX_GOAL} aria-label="Raise the goal by 15 minutes" title="+15 min">
            <PixelIcon name="plus" size={14} />
          </button>
        </div>
      </div>
      {error ? <p className="mt-xs font-read text-read-sm text-error">&gt; {error}</p> : null}
    </Widget>
  );
}
