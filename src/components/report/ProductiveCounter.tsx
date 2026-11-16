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
  "grid h-11 w-11 place-items-center border-2 border-primary-container bg-surface-container-lowest text-primary shadow-[3px_3px_0_0_#000] transition-[transform,box-shadow] duration-75 enabled:hover:bg-primary-container enabled:hover:text-white enabled:active:translate-x-[3px] enabled:active:translate-y-[3px] enabled:active:shadow-none disabled:cursor-not-allowed disabled:opacity-25";

/**
 * Live counter of today's productive time against the daily goal. The goal is
 * set right here with the − / + buttons (15 min steps), saved automatically.
 */
export function ProductiveCounter({ productiveSeconds, goalSeconds, running }: { productiveSeconds: number; goalSeconds: number; running: boolean }) {
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

  const pct = goal > 0 ? Math.min(100, (productiveSeconds / goal) * 100) : 0;
  const reached = productiveSeconds >= goal;
  const left = Math.max(0, goal - productiveSeconds);

  return (
    <Widget
      title="PRODUCTIVE TIME"
      hint="Time spent today on categories marked productive. Set your daily goal with the - and + buttons."
      meta={<span className={reached ? "text-secondary-fixed" : ""}>{reached ? "GOAL REACHED!" : `${Math.round(pct)}%`}</span>}
    >
      <div className={`text-[32px] leading-none sm:text-[40px] ${reached ? "text-secondary-fixed" : running ? "text-primary" : "text-on-background"}`}>
        {formatDuration(productiveSeconds)}
      </div>
      <p className="mt-sm font-read text-read text-on-surface-variant">
        {reached ? "Goal reached. Anything more is a bonus." : `${formatCompact(left).toLowerCase()} left to reach your goal.`}
      </p>

      <div className="mt-md">
        <SegmentedBar value={pct} total={20} heightClass="h-4" color={reached ? "#15ffd1" : "#7c3aed"} label="Progress towards the productive goal" />
      </div>

      <div className="mt-md flex items-center gap-md">
        <button type="button" className={stepButton} onClick={() => change(-STEP_SECONDS)} disabled={goal <= MIN_GOAL} aria-label="Lower the goal by 15 minutes" title="-15 min">
          <PixelIcon name="minus" size={18} />
        </button>
        <div className="min-w-[96px] text-center">
          <div className="text-ui-small text-outline">DAILY GOAL</div>
          <div className="mt-xs text-[18px] leading-none text-on-background" aria-live="polite">
            {formatCompact(goal).toLowerCase()}
          </div>
        </div>
        <button type="button" className={stepButton} onClick={() => change(STEP_SECONDS)} disabled={goal >= MAX_GOAL} aria-label="Raise the goal by 15 minutes" title="+15 min">
          <PixelIcon name="plus" size={18} />
        </button>
      </div>
      {error ? <p className="mt-sm font-read text-read-sm text-error">&gt; {error}</p> : null}
    </Widget>
  );
}
