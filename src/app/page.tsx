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
import { BackgroundAudio, CategoryBars, LimitWarnings, ProductivityCard, SummaryLine, TopSites, TotalCard } from "@/components/report/ReportBlocks";
import { DayTimeline } from "@/components/report/DayTimeline";
import { summarizeDay } from "@/lib/summary";
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

  // Reports refresh whenever the server pushes a new live snapshot.
  const report = useApi<DailyBreakdown>(`/api/stats?period=day&date=${today}`, live.revision);
  const timeline = useApi<TimelineBlock[]>(`/api/timeline?date=${today}`, live.revision);

  if (!live.ready) return <Loading label="BOOTING CHRONO.EXE" />;

  const active = live.activeSession;
  const running = live.trackingState === "RUNNING";
  const paused = live.trackingState === "PAUSED";
  const day = report.data;

  return (
    <div className="grid gap-widget-gutter">
      {live.lastHeartbeatAt === null ? <GetStarted /> : null}

      <div className="grid grid-cols-1 gap-widget-gutter xl:grid-cols-[3fr_2fr]">
        <Widget
          title="NOW TRACKING"
          hint="Play starts recording, pause holds it, stop ends it. The category follows the tab you are looking at."
          meta={
            <span className={`inline-flex items-center gap-xs ${running ? "text-secondary-fixed" : paused ? "text-tertiary" : ""}`}>
              <PixelIcon name={running ? "play" : paused ? "pause" : "stop"} size={8} className={running ? "animate-blink" : ""} />
              {offline ? "SERVER OFF" : running ? "RECORDING" : paused ? "PAUSED" : "STOPPED"}
            </span>
          }
          pulseBorder={running && !live.extensionOnline}
        >
          <div className="flex flex-col items-center gap-md text-center" aria-live="polite">
            <div className="flex min-h-[24px] flex-col items-center gap-xs">
              {running && active ? (
                <>
                  <CategoryBadge category={{ name: active.categoryName, color: active.categoryColor }} size="h2" className={active.isIdle ? "animate-blink" : ""} />
                  <span className="font-read text-read text-on-surface-variant">
                    {active.isIdle ? "You seem away from the keyboard" : active.host ? `on ${siteLabel(active.host)}` : ""}
                  </span>
                </>
              ) : (
                <span className="text-h2 text-outline">{paused ? "PAUSED" : running ? "WAITING..." : "READY"}</span>
              )}
            </div>
            <div className={`text-[32px] leading-none sm:text-[44px] ${running ? "text-secondary-fixed" : paused ? "text-tertiary" : "text-outline-variant"}`}>
              {formatDuration(live.stopwatchSeconds)}
            </div>
            <TrackingControls state={live.trackingState} disabled={offline} />
            <p className="font-read text-read-sm text-outline">
              {offline
                ? serverStopped
                  ? "The server is off. Press play in the Chrome extension to start it again."
                  : "The server is not answering, so the buttons are disabled."
                : running
                ? live.extensionOnline
                  ? active
                    ? `Current activity since ${formatClock(active.startedAt)}.`
                    : "Recording. Waiting for the first signal from the extension."
                  : "The Chrome extension is not connected, so the category cannot follow your tabs."
                : paused
                  ? "Nothing is recorded while paused."
                  : "Press play to start recording your day."}
            </p>
          </div>
        </Widget>

        <TotalCard
          title="TODAY"
          hint="Time you were active today. Time away from the keyboard is not counted."
          seconds={live.totalTrackedSeconds}
          previousSeconds={day?.previous.totalTrackedSeconds ?? 0}
          previousLabel="yesterday"
          goal={{ goalSeconds: live.dailyGoalSeconds, productiveSeconds: live.productiveSeconds }}
          idleSeconds={live.idleSeconds}
        />
      </div>

      {report.error ? <ErrorPanel error={report.error} onRetry={report.reload} /> : null}

      {day ? (
        <>
          <SummaryLine text={summarizeDay(day, true)} />
          <LimitWarnings alerts={day.limitAlerts} />

          <div className="grid grid-cols-1 gap-widget-gutter xl:grid-cols-2">
            <ProductivityCard productivity={day.productivity} previousScore={day.previous.productivityScore} previousLabel="yesterday" />
            <CategoryBars groups={day.categories} hint="Where your active time went today. A red line marks a daily limit." showLimits />
          </div>

          <div className="grid grid-cols-1 gap-widget-gutter xl:grid-cols-[2fr_3fr]">
            <div className="grid content-start gap-widget-gutter">
              <TopSites sites={day.sites} hint="The websites you spent the most time on today." />
              <BackgroundAudio entries={day.backgroundAudio} />
            </div>
            <DayTimeline date={today} blocks={timeline.data ?? []} nowMs={now} />
          </div>
        </>
      ) : report.loading ? (
        <Loading />
      ) : null}
    </div>
  );
}
