"use client";

import { useEffect, useState } from "react";
import type { DailyBreakdown, DaySession, MonthlyHeatmap, TimelineBlock, WeeklyBreakdown } from "@/types";
import { useApi } from "@/hooks/useApi";
import { useDateParam } from "@/hooks/useDateParam";
import { useLive } from "@/components/providers/LiveProvider";
import { Widget } from "@/components/ui/Widget";
import { DateNavigator } from "@/components/ui/DateNavigator";
import { CategoryBadge } from "@/components/ui/CategoryBadge";
import { Empty, ErrorPanel, Loading } from "@/components/ui/States";
import { BackgroundAudio, LimitWarnings, ProductivityCard, SummaryLine, TopSites } from "@/components/report/ReportBlocks";
import { TimeRing } from "@/components/report/TimeRing";
import { ScopeToggle } from "@/components/ui/ScopeToggle";
import { useIncludeOutside } from "@/hooks/useIncludeOutside";
import type { Scope } from "@/lib/scope";
import { siteLabel } from "@/lib/glob";
import { DayTimeline } from "@/components/report/DayTimeline";
import { colorHex } from "@/lib/palette";
import { summarizeDay, summarizeMonth, summarizeWeek } from "@/lib/summary";
import {
  addDays,
  addMonths,
  formatClock,
  formatCompact,
  formatDayLabel,
  formatDuration,
  formatMonthLabel,
  formatWeekLabel,
  parseDateKey,
  startOfMonthKey,
  startOfWeekKey,
  todayKey,
  weekdayShort
} from "@/lib/time";

type Period = "day" | "week" | "month";
const PERIODS: { id: Period; label: string }[] = [
  { id: "day", label: "DAY" },
  { id: "week", label: "WEEK" },
  { id: "month", label: "MONTH" }
];
const HEAT_COLORS = ["#1d1a24", "#3b1d7a", "#5b2bc0", "#7c3aed", "#15ffd1"] as const;

function downloadCsv(date: string, sessions: DaySession[]): void {
  const header = ["start", "end", "category", "away", "site", "duration_seconds"];
  const escape = (value: string) => `"${value.replace(/"/g, '""')}"`;
  const rows = sessions.map((session) =>
    [session.startedAt, session.endedAt ?? "", session.category.name, String(session.isIdle), session.host ?? "", String(session.durationSeconds)]
      .map(escape)
      .join(",")
  );
  const blob = new Blob([[header.join(","), ...rows].join("\n")], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `chrono-${date}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

function ActivityLog({ date, refreshKey }: { date: string; refreshKey: number }) {
  const { data } = useApi<DaySession[]>(`/api/sessions?date=${date}`, refreshKey);
  if (!data || data.length === 0) return null;
  return (
    <Widget
      title="ACTIVITY LOG"
      hint="Every activity of the day, in order. Grey rows are time away from the keyboard."
      meta={
        <button type="button" onClick={() => downloadCsv(date, data)} className="border border-primary-container px-sm py-[2px] text-primary hover:bg-surface-container-highest">
          EXPORT CSV
        </button>
      }
    >
      <div className="max-h-[360px] overflow-auto">
        <table className="w-full min-w-[480px] font-read text-read-sm">
          <thead className="sticky top-0 bg-surface-container-high">
            <tr className="border-b border-outline-variant text-left text-secondary-fixed">
              <th className="pb-xs font-normal">TIME</th>
              <th className="pb-xs font-normal">CATEGORY</th>
              <th className="pb-xs font-normal">SITE</th>
              <th className="pb-xs text-right font-normal">DURATION</th>
            </tr>
          </thead>
          <tbody>
            {data.map((session) => (
              <tr key={session.id} className={`border-b border-outline-variant last:border-0 ${session.isIdle ? "opacity-50" : ""}`}>
                <td className="py-[3px] text-on-surface-variant">
                  {formatClock(session.startedAt)}-{session.isActive ? "now" : session.endedAt ? formatClock(session.endedAt) : "--"}
                </td>
                <td className="py-[3px]">{session.isIdle ? <span className="text-outline">AWAY</span> : <CategoryBadge category={session.category} size="ui-small" />}</td>
                <td className="max-w-[220px] truncate py-[3px] text-outline">{session.isIdle ? "" : session.host ? siteLabel(session.host) : ""}</td>
                <td className="py-[3px] text-right text-on-background">{formatDuration(session.durationSeconds)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Widget>
  );
}

const scopeHint = (period: string, scope: Scope) =>
  `Your active time ${period}${scope === "all" ? " on the whole computer" : " in Chrome only"}, per category. Hover a slice for details.`;

function DayView({ date, refreshKey, scope }: { date: string; refreshKey: number; scope: Scope }) {
  const { data, error, loading, reload } = useApi<DailyBreakdown>(`/api/stats?period=day&date=${date}&scope=${scope}`, refreshKey);
  const timeline = useApi<TimelineBlock[]>(`/api/timeline?date=${date}`, refreshKey);
  if (error) return <ErrorPanel error={error} onRetry={reload} />;
  if (loading || !data) return <Loading />;
  const isToday = date === todayKey();

  return (
    <div className="grid gap-widget-gutter">
      <SummaryLine text={summarizeDay(data, isToday)} />
      <LimitWarnings alerts={data.limitAlerts} />
      <div className="grid grid-cols-1 items-start gap-widget-gutter xl:grid-cols-2">
        <div className="grid content-start gap-widget-gutter">
          <TimeRing
            hint={scopeHint("this day", scope)}
            groups={data.categories}
            totalSeconds={data.totalTrackedSeconds}
            centerLabel={scope === "all" ? "ON YOUR PC" : "IN CHROME"}
            previousSeconds={data.previous.totalTrackedSeconds}
            previousLabel="the day before"
            idleSeconds={data.idleSeconds}
            showLimits
          />
          <ProductivityCard productivity={data.productivity} previousScore={data.previous.productivityScore} previousLabel="the day before" />
        </div>
        <div className="grid content-start gap-widget-gutter">
          <TopSites sites={data.sites} hint="The websites you spent the most time on this day." />
          <BackgroundAudio entries={data.backgroundAudio} period="this day" />
        </div>
      </div>
      <DayTimeline date={date} blocks={timeline.data ?? []} nowMs={isToday ? Date.now() : undefined} includeOutside={scope === "all"} />
      <ActivityLog date={date} refreshKey={refreshKey} />
    </div>
  );
}

function WeekView({ date, refreshKey, scope, onSelectDay }: { date: string; refreshKey: number; scope: Scope; onSelectDay: (key: string) => void }) {
  const { data, error, loading, reload } = useApi<WeeklyBreakdown>(`/api/stats?period=week&date=${startOfWeekKey(date)}&scope=${scope}`, refreshKey);
  if (error) return <ErrorPanel error={error} onRetry={reload} />;
  if (loading || !data) return <Loading />;

  const max = Math.max(1, ...data.days.map((day) => day.totalTrackedSeconds));
  const today = todayKey();

  return (
    <div className="grid gap-widget-gutter">
      <SummaryLine text={summarizeWeek(data)} />
      <div className="grid grid-cols-1 items-start gap-widget-gutter xl:grid-cols-2">
        <div className="grid content-start gap-widget-gutter">
          <TimeRing
            hint={scopeHint("this week", scope)}
            groups={data.weeklyTotals}
            totalSeconds={data.totalTrackedSeconds}
            centerLabel="THIS WEEK"
            previousSeconds={data.previous.totalTrackedSeconds}
            previousLabel="last week"
          />
          <ProductivityCard productivity={data.productivity} previousScore={data.previous.productivityScore} previousLabel="last week" />
        </div>
        <div className="grid content-start gap-widget-gutter">
          <TopSites sites={data.sites} hint="The websites you spent the most time on this week." />
          <BackgroundAudio entries={data.backgroundAudio ?? []} period="this week" />
        </div>
      </div>

      <Widget title="DAY BY DAY" hint="Active time per day, colored by category. The % under each day is its productivity score. Click a day to open it.">
        <div className="grid grid-cols-7 gap-sm">
          {data.days.map((day) => {
            const future = day.date > today;
            return (
              <button
                type="button"
                key={day.date}
                disabled={future}
                onClick={() => onSelectDay(day.date)}
                aria-label={`${formatDayLabel(day.date)}: ${formatCompact(day.totalTrackedSeconds)} active. Open this day.`}
                className={`group flex flex-col items-stretch gap-xs p-xs text-center hover:bg-surface-container-highest disabled:cursor-default disabled:opacity-40 disabled:hover:bg-transparent ${
                  day.date === today ? "outline outline-1 outline-secondary-fixed" : ""
                }`}
              >
                <span className="font-read text-read-sm text-on-surface-variant">{future ? "--" : formatCompact(day.totalTrackedSeconds).toLowerCase()}</span>
                <div className="flex h-40 flex-col-reverse border-b border-outline-variant">
                  <div className="flex w-full flex-col-reverse" style={{ height: `${(day.totalTrackedSeconds / max) * 100}%` }}>
                    {day.categories.map((entry) => (
                      <div key={entry.category.id} title={`${entry.category.name} ${formatCompact(entry.totalSeconds)}`} style={{ height: `${entry.percentage}%`, backgroundColor: colorHex(entry.category.color) }} />
                    ))}
                  </div>
                </div>
                <span className={`text-ui-small ${day.date === today ? "text-secondary-fixed" : "text-outline"} group-hover:text-on-background`}>{weekdayShort(day.date)}</span>
                <span className="font-read text-read-sm text-outline">{day.productivityScore === null ? "" : `${day.productivityScore}%`}</span>
              </button>
            );
          })}
        </div>
      </Widget>

    </div>
  );
}

function MonthView({ date, refreshKey, scope, onSelectDay }: { date: string; refreshKey: number; scope: Scope; onSelectDay: (key: string) => void }) {
  const { data, error, loading, reload } = useApi<MonthlyHeatmap>(`/api/stats?period=month&date=${startOfMonthKey(date)}&scope=${scope}`, refreshKey);
  if (error) return <ErrorPanel error={error} onRetry={reload} />;
  if (loading || !data) return <Loading />;

  const today = todayKey();
  const leading = (parseDateKey(data.days[0].date).getDay() + 6) % 7;

  return (
    <div className="grid gap-widget-gutter">
      <SummaryLine text={summarizeMonth(data)} />
      <div className="grid grid-cols-1 items-start gap-widget-gutter xl:grid-cols-2">
        <div className="grid content-start gap-widget-gutter">
          <TimeRing
            hint={scopeHint("this month", scope)}
            groups={data.categories}
            totalSeconds={data.monthlyTotal}
            centerLabel="THIS MONTH"
            previousSeconds={data.previous.totalTrackedSeconds}
            previousLabel="last month"
          />
          <ProductivityCard productivity={data.productivity} previousScore={data.previous.productivityScore} previousLabel="last month" />
        </div>
        <div className="grid content-start gap-widget-gutter">
          <TopSites sites={data.sites} hint="The websites you spent the most time on this month." />
          <BackgroundAudio entries={data.backgroundAudio ?? []} period="this month" />
        </div>
      </div>

      <Widget title="CALENDAR" hint="The brighter the square, the more active the day. Click a day to open it.">
        <div className="grid grid-cols-7 gap-[3px]">
          {["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"].map((day) => (
            <div key={day} className="pb-xs text-center text-ui-small text-outline">
              {day}
            </div>
          ))}
          {Array.from({ length: leading }, (_, index) => (
            <div key={`pad-${index}`} aria-hidden />
          ))}
          {data.days.map((day) => (
            <button
              type="button"
              key={day.date}
              disabled={day.date > today}
              onClick={() => onSelectDay(day.date)}
              aria-label={`${formatDayLabel(day.date)}: ${formatCompact(day.totalTrackedSeconds)} active`}
              title={`${formatDayLabel(day.date)}: ${formatCompact(day.totalTrackedSeconds).toLowerCase()}`}
              className={`flex h-12 flex-col items-start justify-between p-xs text-left transition-transform hover:scale-105 disabled:cursor-default disabled:opacity-30 disabled:hover:scale-100 ${
                day.date === today ? "outline outline-1 outline-secondary-fixed" : ""
              } ${day.intensity === 4 ? "text-on-secondary" : "text-on-surface-variant"}`}
              style={{ backgroundColor: HEAT_COLORS[day.intensity] }}
            >
              <span className="text-ui-small">{Number(day.date.slice(8))}</span>
              <span className="font-read text-read-sm leading-none">{day.totalTrackedSeconds > 0 ? formatCompact(day.totalTrackedSeconds).toLowerCase() : ""}</span>
            </button>
          ))}
        </div>
        <div className="mt-md flex items-center gap-xs font-read text-read-sm text-outline">
          Less
          {HEAT_COLORS.map((color) => (
            <span key={color} aria-hidden className="h-3 w-3 border border-outline-variant" style={{ backgroundColor: color }} />
          ))}
          More
        </div>
      </Widget>

    </div>
  );
}

export default function HistoryPage() {
  const [date, setDate] = useDateParam();
  const [period, setPeriodState] = useState<Period>("day");
  const { revision } = useLive();
  const { includeOutside, setIncludeOutside, scope } = useIncludeOutside();
  const today = todayKey();

  useEffect(() => {
    const view = new URLSearchParams(window.location.search).get("view");
    if (view === "week" || view === "month") setPeriodState(view);
  }, []);

  const setPeriod = (next: Period) => {
    setPeriodState(next);
    const url = new URL(window.location.href);
    if (next === "day") url.searchParams.delete("view");
    else url.searchParams.set("view", next);
    window.history.replaceState(null, "", url.toString());
  };

  const selectDay = (key: string) => {
    setPeriod("day");
    setDate(key);
  };

  const step = (direction: 1 | -1) => {
    if (period === "day") setDate(addDays(date, direction));
    else if (period === "week") setDate(addDays(startOfWeekKey(date), 7 * direction));
    else setDate(addMonths(date, direction));
  };

  const isCurrent =
    period === "day" ? date === today : period === "week" ? startOfWeekKey(date) === startOfWeekKey(today) : startOfMonthKey(date) === startOfMonthKey(today);
  const label = period === "day" ? formatDayLabel(date) : period === "week" ? formatWeekLabel(startOfWeekKey(date)) : formatMonthLabel(startOfMonthKey(date));
  // Only the current period changes live; past periods are immutable.
  const refreshKey = isCurrent ? revision : 0;

  return (
    <div className="grid gap-widget-gutter">
      <div className="flex flex-wrap items-center justify-between gap-md">
        <div className="flex gap-[1px]" role="tablist" aria-label="History period">
          {PERIODS.map((item) => (
            <button
              type="button"
              role="tab"
              aria-selected={period === item.id}
              key={item.id}
              className={`border border-primary-container px-md py-sm text-label ${
                period === item.id ? "bg-primary-container text-white" : "text-outline hover:bg-surface-container-highest"
              }`}
              onClick={() => setPeriod(item.id)}
            >
              {item.label}
            </button>
          ))}
        </div>
        <ScopeToggle checked={includeOutside} onChange={setIncludeOutside} />
        <DateNavigator label={label} onPrev={() => step(-1)} onNext={() => step(1)} onToday={() => setDate(today)} disableNext={isCurrent} isCurrent={isCurrent} />
      </div>

      {period === "day" ? <DayView date={date} refreshKey={refreshKey} scope={scope} /> : null}
      {period === "week" ? <WeekView date={date} refreshKey={refreshKey} scope={scope} onSelectDay={selectDay} /> : null}
      {period === "month" ? <MonthView date={date} refreshKey={refreshKey} scope={scope} onSelectDay={selectDay} /> : null}
      {period === "day" && date > today ? <Empty>This day has not happened yet.</Empty> : null}
    </div>
  );
}
