"use client";

import { useLive } from "@/components/providers/LiveProvider";
import { useDashboard } from "@/hooks/useDashboard";
import { formatClock } from "@/lib/time";

function Dot({ ok }: { ok: boolean }) {
  return <span aria-hidden className={`inline-block h-2 w-2 ${ok ? "bg-secondary-fixed" : "bg-error"}`} />;
}

/** Real system status: stream, database and extension health. */
export function Footer() {
  const { connectionStatus, dbUnreachable } = useLive();
  const { extensionOnline, lastHeartbeatAt, ready } = useDashboard();
  const streamOk = connectionStatus === "connected";

  return (
    <footer className="fixed bottom-0 left-0 right-0 z-40 flex h-[32px] items-center justify-between gap-md overflow-hidden border-t border-primary-container bg-surface-container-low px-md text-ui-small uppercase text-outline md:left-[220px]">
      <div className="flex items-center gap-md whitespace-nowrap">
        <span className="flex items-center gap-xs">
          <Dot ok={streamOk} /> APP: {streamOk ? "LIVE" : connectionStatus.toUpperCase()}
        </span>
        <span className="flex items-center gap-xs">
          <Dot ok={!dbUnreachable && streamOk} /> DATABASE: {dbUnreachable ? "OFFLINE" : streamOk ? "OK" : "--"}
        </span>
        <span className="hidden items-center gap-xs sm:flex">
          <Dot ok={extensionOnline} /> EXTENSION: {!ready ? "--" : extensionOnline ? "CONNECTED" : "NOT CONNECTED"}
        </span>
      </div>
      <div className="hidden whitespace-nowrap lg:block" suppressHydrationWarning>
        LAST SIGNAL: {lastHeartbeatAt ? formatClock(lastHeartbeatAt, true) : "NEVER"}
      </div>
    </footer>
  );
}
