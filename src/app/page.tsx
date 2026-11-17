"use client";

import type { DailyBreakdown, TimelineBlock } from "@/types";
import { useDashboard } from "@/hooks/useDashboard";
import { useLive } from "@/components/providers/LiveProvider";
import { useApi } from "@/hooks/useApi";
import { useNow } from "@/hooks/useNow";
import { Widget } from "@/components/ui/Widget";
import { CategoryBadge } from "@/components/ui/CategoryBadge";
import { TrackingControls } from "@/components/ui/TrackingControls";
import { PixelIcon } from "@/components/ui/PixelIcon";
import { ErrorPanel, Loading } from "@/components/ui/States";
import { BackgroundAudio, TopSites } from "@/components/report/ReportBlocks";
import { TimeRing } from "@/components/report/TimeRing";
import { ProductiveCounter } from "@/components/report/ProductiveCounter";
import { ScopeToggle } from "@/components/ui/ScopeToggle";
import { useIncludeOutside } from "@/hooks/useIncludeOutside";
import { DayTimeline } from "@/components/report/DayTimeline";
import { siteLabel } from "@/lib/glob";
import { formatClock, formatDuration, todayKey } from "@/lib/time";

function GetStarted() {
  return (
    <Widget title="GET STARTED" hint="Three steps and CHRONO.EXE records your screen time on its own.">
      <ol className="grid gap-md font-read text-read text-on-background md:grid-cols-3">
        <li className="border border-outline-variant p-sm">
          <div className="text-label text-secondary-fixed">1. INSTALL</div>
          Open chrome://extensions, enable Developer mode, click &quot;Load unpacked&quot; and pick the /extension folder.
        </li>
        <li className="border border-outline-variant p-sm">
          <div className="text-label text-secondary-fixed">2. PRESS PLAY</div>
          Use the play button here or in the extension popup. Pause or stop anytime.
        </li>
        <li className="border border-outline-variant p-sm">
          <div className="text-label text-secondary-fixed">3. BROWSE</div>
          Every 30 seconds the extension reports your active tab. Come back here to see where your time went.
        </li>
      </ol>
    </Widget>
  );
}

export default function TodayPage() {
  const live = useDashboard();
  const { connectionStatus, serverStopped } = useLive();
  // Server unreachable (or shut down by STOP): only the extension can start it.
  const offline = connectionStatus === "reconnecting";
  const now = useNow(30000);
  const today = todayKey();
  const { includeOutside, setIncludeOutside, scope } = useIncludeOutside();

  // Reports refresh whenever the server pushes a new live snapshot.
  const report = useApi<DailyBreakdown>(`/api/stats?period=day&date=${today}&scope=${scope}`, live.revision);
  const timeline = useApi<TimelineBlock[]>(`/api/timeline?date=${today}`, live.revision);

  if (!live.ready) return <Loading label="BOOTING CHRONO.EXE" />;

  const active = live.activeSession;
  const running = live.trackingState === "RUNNING";
  const paused = live.trackingState === "PAUSED";
  const day = report.data;

  const status = offline
    ? serverStopped
      ? "Server off. Press play in the Chrome extension."
      : "The server is not answering."
    : running
      ? live.extensionOnline
        ? active
          ? active.isIdle
            ? "You seem away from the keyboard."
            : active.host
              ? `on ${siteLabel(active.host)} since ${formatClock(active.startedAt)}`
              : `since ${formatClock(active.startedAt)}`
          : "Waiting for the extension..."
        : "Extension not connected."
      : paused
        ? "Nothing is recorded while paused."
        : "Press play to start recording.";

  const timer = (
    <Widget
      title="NOW TRACKING"
      hint="Play starts recording, pause holds it, stop ends it. The category follows the tab you are looking at."
      meta={
        <span className={`inline-flex items-center gap-xs ${running ? "text-secondary-fixed" : paused ? "text-tertiary" : ""}`}>
          <PixelIcon name={running ? "play" : paused ? "pause" : "stop"} size={8} className={running ? "animate-blink" : ""} />
          {offline ? "OFF" : running ? "REC" : paused ? "PAUSED" : "STOPPED"}
        </span>
      }
      pulseBorder={running && !live.extensionOnline}
      compact
    >
      <div className="flex flex-col items-center gap-md text-center" aria-live="polite">
        <div className={`text-[28px] leading-none 2xl:text-[36px] ${running ? "text-secondary-fixed" : paused ? "text-tertiary" : "text-outline-variant"}`}>
          {formatDuration(live.stopwatchSeconds)}
        </div>
        <div className="flex min-h-[18px] max-w-full items-center justify-center">
          {running && active && !active.isIdle ? (
            <CategoryBadge category={{ name: active.categoryName, color: active.categoryColor }} size="ui-small" />
          ) : (
            <span className="text-ui-small text-outline">{offline ? "SERVER OFF" : paused ? "PAUSED" : running ? "WAITING..." : "READY"}</span>
          )}
        </div>
        <TrackingControls state={live.trackingState} disabled={offline} />
        <p className="max-w-full truncate font-read text-read-sm text-outline" title={status}>
          {status}
        </p>
      </div>
    </Widget>
  );

  const ring = day ? (
    <TimeRing
      hint={
        includeOutside
          ? "Your active time today on the whole computer, per category. Hover a slice for details. Time away from the keyboard is not counted."
          : "Your active time today in Chrome only, per category. Hover a slice for details. Time away from the keyboard is not counted."
      }
      groups={day.categories}
      totalSeconds={includeOutside ? live.totalTrackedSeconds : Math.max(0, live.totalTrackedSeconds - live.outsideSeconds)}
      centerLabel={includeOutside ? "ON YOUR PC" : "IN CHROME"}
      previousSeconds={day.previous.totalTrackedSeconds}
      previousLabel="yesterday"
      idleSeconds={live.idleSeconds}
      showLimits
      live
      fill
      toolbar={<ScopeToggle checked={includeOutside} onChange={setIncludeOutside} />}
    />
  ) : report.loading ? (
    <Loading />
  ) : null;

  return (
    <div className="grid gap-widget-gutter">
      {live.lastHeartbeatAt === null ? <GetStarted /> : null}
      {report.error ? <ErrorPanel error={report.error} onRetry={report.reload} /> : null}

      {/* One screen, no scrolling (from 1280px wide): left column timer + top sites, right the ring on top. */}
      <div className="grid grid-cols-1 gap-widget-gutter xl:h-[calc(100vh-124px)] xl:min-h-[600px] xl:grid-cols-[minmax(260px,1fr)_3fr]">
        <div className="grid min-h-0 grid-rows-[auto_minmax(0,1fr)] gap-widget-gutter">
          {timer}
          {day ? <TopSites sites={day.sites} hint="The websites you spent the most time on today." compact /> : <div />}
        </div>

        <div className="grid min-h-0 grid-rows-[minmax(0,1.25fr)_minmax(0,1fr)] gap-widget-gutter">
          {ring}
          <div className="grid min-h-0 grid-cols-1 gap-widget-gutter lg:grid-cols-[minmax(340px,1.15fr)_2fr]">
            <div className="grid min-h-0 grid-rows-[minmax(0,1fr)_auto] gap-widget-gutter">
              <ProductiveCounter
                productiveSeconds={live.productiveSeconds}
                goalSeconds={live.dailyGoalSeconds}
                running={running}
                score={day?.productivity.score ?? null}
                previousScore={day?.previous.productivityScore ?? null}
              />
              <BackgroundAudio entries={day?.backgroundAudio ?? []} compact />
            </div>
            <DayTimeline date={today} blocks={timeline.data ?? []} nowMs={now} includeOutside={includeOutside} compact />
          </div>
        </div>
      </div>
    </div>
  );
}
