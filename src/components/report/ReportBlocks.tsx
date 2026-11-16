"use client";

import type { LimitAlert, ProductivityStats, SiteStat } from "@/types";
import { Widget } from "@/components/ui/Widget";
import { Empty } from "@/components/ui/States";
import { Trend } from "@/components/report/Trend";
import { colorHex } from "@/lib/palette";
import { formatCompact } from "@/lib/time";
import { siteLabel } from "@/lib/glob";

const PRODUCTIVITY_COLORS = { productive: "#15ffd1", neutral: "#958da1", distracting: "#ff6b8a" } as const;

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
