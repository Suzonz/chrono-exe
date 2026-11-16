"use client";

import { useState } from "react";
import type { CategoryBreakdown, LimitAlert, ProductivityStats, SiteStat } from "@/types";
import { apiFetch, toApiError } from "@/hooks/useApi";
import { Widget } from "@/components/ui/Widget";
import { CategoryBadge } from "@/components/ui/CategoryBadge";
import { SegmentedBar } from "@/components/ui/SegmentedBar";
import { Empty } from "@/components/ui/States";
import { Trend } from "@/components/report/Trend";
import { colorHex } from "@/lib/palette";
import { formatCompact, formatDuration, parseHoursMinutes, toHoursMinutes } from "@/lib/time";
import { siteLabel } from "@/lib/glob";

type Group = Omit<CategoryBreakdown, "sessions">;

const PRODUCTIVITY_COLORS = { productive: "#15ffd1", neutral: "#958da1", distracting: "#ff6b8a" } as const;

/**
 * Daily goal of PRODUCTIVE time, with progress. The goal can be changed in place
 * (it is also in Settings > Preferences).
 */
function ProductiveGoal({ goalSeconds, productiveSeconds }: { goalSeconds: number; productiveSeconds: number }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(toHoursMinutes(goalSeconds));
  const [error, setError] = useState<string | null>(null);
  const pct = goalSeconds > 0 ? Math.min(100, (productiveSeconds / goalSeconds) * 100) : 0;
  const reached = pct >= 100;

  const save = async () => {
    const seconds = parseHoursMinutes(value);
    if (seconds === null || seconds < 60) {
      setError("Use hours:minutes, for example 04:00");
      return;
    }
    try {
      await apiFetch("/api/settings", { method: "PUT", body: JSON.stringify({ dailyGoalSeconds: seconds }) });
      setEditing(false);
      setError(null);
    } catch (err) {
      setError(toApiError(err).message);
    }
  };

  return (
    <div className="mt-md">
      <div className="mb-xs flex flex-wrap items-center justify-between gap-sm font-read text-read-sm text-outline">
        {editing ? (
          <form
            className="flex items-center gap-xs"
            onSubmit={(event) => {
              event.preventDefault();
              void save();
            }}
          >
            <label htmlFor="goal-input">Productive goal</label>
            <input
              id="goal-input"
              autoFocus
              value={value}
              onChange={(event) => setValue(event.target.value)}
              className="w-20 border border-outline-variant bg-surface-container-lowest px-xs text-center text-on-background focus:border-secondary-fixed focus:outline-none"
              placeholder="04:00"
            />
            <button type="submit" className="border border-secondary-fixed px-xs text-secondary-fixed hover:bg-secondary-fixed hover:text-on-secondary">
              SAVE
            </button>
            <button type="button" onClick={() => setEditing(false)} className="px-xs hover:text-on-background">
              CANCEL
            </button>
          </form>
        ) : (
          <span>
            Productive goal: <span className="text-on-background">{formatCompact(productiveSeconds).toLowerCase()}</span> / {formatCompact(goalSeconds).toLowerCase()}{" "}
            <button
              type="button"
              onClick={() => {
                setValue(toHoursMinutes(goalSeconds));
                setEditing(true);
              }}
              className="ml-xs border border-outline-variant px-xs text-outline hover:border-secondary-fixed hover:text-secondary-fixed"
              aria-label="Change the daily productive goal"
            >
              EDIT
            </button>
          </span>
        )}
        <span className={reached ? "text-secondary-fixed" : ""}>{reached ? "Reached!" : `${Math.round(pct)}%`}</span>
      </div>
      {error ? <p className="mb-xs font-read text-read-sm text-error">{error}</p> : null}
      <SegmentedBar value={pct} total={20} heightClass="h-3" color={reached ? "#15ffd1" : "#7c3aed"} label="Productive goal" />
    </div>
  );
}

/** Big active-time figure with trend, optional productive goal and away time. */
export function TotalCard({
  title,
  hint,
  seconds,
  previousSeconds,
  previousLabel,
  goal,
  idleSeconds
}: {
  title: string;
  hint: string;
  seconds: number;
  previousSeconds: number;
  previousLabel: string;
  goal?: { goalSeconds: number; productiveSeconds: number };
  idleSeconds?: number;
}) {
  return (
    <Widget title={title} hint={hint}>
      <div className="text-[28px] leading-none text-on-background">{formatDuration(seconds)}</div>
      <div className="mt-sm">
        <Trend current={seconds} previous={previousSeconds} label={previousLabel} />
      </div>
      {goal ? <ProductiveGoal goalSeconds={goal.goalSeconds} productiveSeconds={goal.productiveSeconds} /> : null}
      {idleSeconds !== undefined ? (
        <p className="mt-md font-read text-read-sm text-outline">Away from keyboard: {formatCompact(idleSeconds).toLowerCase()} (not counted)</p>
      ) : null}
    </Widget>
  );
}

/** Productivity score: share of active time on productive categories. */
export function ProductivityCard({
  productivity,
  previousScore,
  previousLabel
}: {
  productivity: ProductivityStats;
  previousScore: number | null;
  previousLabel: string;
}) {
  const total = productivity.productiveSeconds + productivity.neutralSeconds + productivity.distractingSeconds;
  const parts = [
    { key: "productive", label: "Productive", seconds: productivity.productiveSeconds, color: PRODUCTIVITY_COLORS.productive },
    { key: "neutral", label: "Neutral", seconds: productivity.neutralSeconds, color: PRODUCTIVITY_COLORS.neutral },
    { key: "distracting", label: "Distracting", seconds: productivity.distractingSeconds, color: PRODUCTIVITY_COLORS.distracting }
  ];
  const score = productivity.score;
  const scoreColor = score === null ? "text-outline" : score >= 60 ? "text-secondary-fixed" : score >= 35 ? "text-tertiary" : "text-error";

  return (
    <Widget title="PRODUCTIVITY" hint="Share of your active time spent on productive categories. Choose which categories count as productive in Settings.">
      <div className="flex items-end gap-md">
        <div className={`text-[28px] leading-none ${scoreColor}`}>{score === null ? "--" : `${score}%`}</div>
        <div className="pb-[2px]">
          <Trend current={score} previous={previousScore} label={previousLabel} kind="points" />
        </div>
      </div>
      <div className="mt-md flex h-4 w-full overflow-hidden border border-outline-variant bg-surface-container-lowest" role="img" aria-label="Productive, neutral and distracting time">
        {total > 0
          ? parts.map((part) => (
              <div key={part.key} style={{ width: `${(part.seconds / total) * 100}%`, backgroundColor: part.color }} />
            ))
          : null}
      </div>
      <ul className="mt-sm grid grid-cols-3 gap-sm font-read text-read-sm">
        {parts.map((part) => (
          <li key={part.key}>
            <span className="inline-flex items-center gap-xs" style={{ color: part.color }}>
              <span aria-hidden className="h-2 w-2" style={{ backgroundColor: part.color }} />
              {part.label}
            </span>
            <div className="text-on-surface-variant">{formatCompact(part.seconds).toLowerCase()}</div>
          </li>
        ))}
      </ul>
    </Widget>
  );
}

/** Time per category, with daily limits when set. */
export function CategoryBars({ groups, title = "BY CATEGORY", hint, showLimits = false }: { groups: Group[]; title?: string; hint: string; showLimits?: boolean }) {
  const max = Math.max(1, ...groups.map((group) => group.totalSeconds));
  return (
    <Widget title={title} hint={hint}>
      {groups.length === 0 ? (
        <Empty>No activity recorded.</Empty>
      ) : (
        <ul className="space-y-md">
          {groups.map((group) => {
            const limit = showLimits ? group.category.dailyLimitSeconds : null;
            const over = limit !== null && group.totalSeconds >= limit;
            const scale = Math.max(max, limit ?? 0);
            return (
              <li key={group.category.id}>
                <div className="mb-xs flex items-baseline justify-between gap-sm">
                  <CategoryBadge category={group.category} />
                  <span className="font-read text-read text-on-background">
                    {formatCompact(group.totalSeconds).toLowerCase()}
                    <span className="ml-sm text-read-sm text-outline">{Math.round(group.percentage)}%</span>
                  </span>
                </div>
                <div className="relative h-3 bg-surface-container-lowest">
                  <div
                    className="h-full"
                    style={{ width: `${(group.totalSeconds / scale) * 100}%`, backgroundColor: over ? "#ff6b8a" : colorHex(group.category.color) }}
                  />
                  {limit !== null ? (
                    <div aria-hidden className="absolute -bottom-[3px] -top-[3px] w-[2px] bg-error" style={{ left: `${Math.min(100, (limit / scale) * 100)}%` }} />
                  ) : null}
                </div>
                {limit !== null ? (
                  <p className={`mt-xs font-read text-read-sm ${over ? "text-error" : "text-outline"}`}>
                    {over ? `! Limit of ${formatCompact(limit).toLowerCase()} reached` : `Limit ${formatCompact(limit).toLowerCase()} / day`}
                  </p>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </Widget>
  );
}

/** Websites where the time went. */
export function TopSites({ sites, hint }: { sites: SiteStat[]; hint: string }) {
  const max = Math.max(1, ...sites.map((site) => site.seconds));
  return (
    <Widget title="TOP SITES" hint={hint}>
      {sites.length === 0 ? (
        <Empty>No websites recorded.</Empty>
      ) : (
        <ol className="space-y-sm">
          {sites.map((site, index) => (
            <li key={site.host} className="grid grid-cols-[22px_minmax(0,1fr)_auto] items-center gap-x-sm">
              <span className="text-ui-small text-outline">{String(index + 1).padStart(2, "0")}</span>
              <div className="min-w-0">
                <div className="truncate font-read text-read text-on-background" title={site.host}>
                  {siteLabel(site.host)}
                </div>
                <div className="mt-[2px] h-1 bg-surface-container-lowest">
                  <div className="h-full" style={{ width: `${(site.seconds / max) * 100}%`, backgroundColor: colorHex(site.category.color) }} />
                </div>
              </div>
              <span className="font-read text-read text-on-surface-variant">{formatCompact(site.seconds).toLowerCase()}</span>
            </li>
          ))}
        </ol>
      )}
    </Widget>
  );
}

/** Red retro warning when categories went over their daily limit. */
export function LimitWarnings({ alerts }: { alerts: LimitAlert[] }) {
  if (alerts.length === 0) return null;
  return (
    <div role="alert" className="border-2 border-error bg-error-container/40 px-md py-sm">
      <div className="text-label text-error">WARNING: LIMIT REACHED</div>
      <ul className="mt-xs font-read text-read text-on-error-container">
        {alerts.map((alert) => (
          <li key={alert.category.id}>
            {alert.category.name}: {formatCompact(alert.usedSeconds).toLowerCase()} today, your limit is {formatCompact(alert.limitSeconds).toLowerCase()}.
          </li>
        ))}
      </ul>
    </div>
  );
}

/** One-sentence summary of a period. */
export function SummaryLine({ text }: { text: string }) {
  return (
    <div className="flex items-start gap-sm border border-outline-variant bg-surface-container-lowest px-md py-sm">
      <span aria-hidden className="text-label text-secondary-fixed">&gt;</span>
      <p className="font-read text-read text-on-background">{text}</p>
    </div>
  );
}

/** Sites that played sound in background tabs: shown for information, never counted. */
export function BackgroundAudio({ entries }: { entries: { host: string; seconds: number }[] }) {
  if (entries.length === 0) return null;
  return (
    <Widget title="BACKGROUND AUDIO" hint="Tabs playing sound while you were doing something else. Listening in the background is not counted as active time.">
      <ul className="space-y-xs font-read text-read">
        {entries.map((entry) => (
          <li key={entry.host} className="flex justify-between gap-sm">
            <span className="truncate text-on-surface-variant">{siteLabel(entry.host)}</span>
            <span className="text-outline">{formatCompact(entry.seconds).toLowerCase()}</span>
          </li>
        ))}
      </ul>
    </Widget>
  );
}
