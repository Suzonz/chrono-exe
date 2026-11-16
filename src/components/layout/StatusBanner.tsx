"use client";

import { useLive } from "@/components/providers/LiveProvider";
import { useDashboard } from "@/hooks/useDashboard";

function Banner({ tone, title, children }: { tone: "error" | "warn"; title: string; children: React.ReactNode }) {
  const colors = tone === "error" ? "border-error text-error" : "border-tertiary text-tertiary";
  return (
    <div role="alert" className={`mb-md flex flex-wrap items-center justify-between gap-md border bg-surface-container-lowest px-md py-sm ${colors}`}>
      <div>
        <div className="text-label">{title}</div>
        <div className="mt-xs font-read text-read text-on-surface-variant">{children}</div>
      </div>
    </div>
  );
}

/** Global error screens: connection lost, database down, extension offline. */
export function StatusBanner() {
  const { connectionStatus, dbUnreachable, retryIn, reconnect } = useLive();
  const { extensionOnline, ready, lastHeartbeatAt, trackingState } = useDashboard();

  if (connectionStatus === "reconnecting") {
    return (
      <Banner tone="error" title="CONNECTION LOST">
        <span className="mr-md">
          {retryIn !== null && retryIn > 0 ? `The app server is not answering. Retrying in ${retryIn}s...` : "Reconnecting..."}
        </span>
        <button type="button" onClick={reconnect} className="border border-error px-sm py-[2px] text-error hover:bg-error-container hover:text-on-error-container">
          [RETRY NOW]
        </button>
      </Banner>
    );
  }

  if (dbUnreachable) {
    return (
      <Banner tone="error" title="DATABASE OFFLINE">
        <span className="mr-md">Nothing can be saved right now. Check that prisma/chrono.db exists (run npm run setup), then retry.</span>
        <button type="button" onClick={reconnect} className="border border-error px-sm py-[2px] text-error hover:bg-error-container hover:text-on-error-container">
          [RETRY]
        </button>
      </Banner>
    );
  }

  // Only relevant while tracking is running: paused/stopped needs no extension.
  if (ready && !extensionOnline && trackingState === "RUNNING") {
    return (
      <Banner tone="warn" title="EXTENSION NOT CONNECTED">
        {lastHeartbeatAt
          ? "Recording is on, but the Chrome extension has been silent for 2 minutes. Check that Chrome is open and the extension is enabled."
          : "Recording is on, but the Chrome extension is not installed yet. See GET STARTED below."}
      </Banner>
    );
  }

  return null;
}
