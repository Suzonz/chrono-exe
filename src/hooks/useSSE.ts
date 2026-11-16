"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { DashboardState, SSEEvent } from "@/types";

export type ConnectionStatus = "connecting" | "connected" | "reconnecting";

export interface SSEState {
  dashboardState: DashboardState | null;
  connectionStatus: ConnectionStatus;
  dbUnreachable: boolean;
  /** The server shut down after STOP (it was started by the extension). */
  serverStopped: boolean;
  /** Seconds before the next reconnection attempt, while reconnecting. */
  retryIn: number | null;
  /** Increments on every DASHBOARD_UPDATE so pages can refetch. */
  revision: number;
  /** Local time (ms) at which the last snapshot was received. */
  receivedAt: number | null;
  reconnect: () => void;
}

const INITIAL_BACKOFF_MS = 5000;
const MAX_BACKOFF_MS = 60000;

/**
 * Single EventSource connection to `/api/sse` with exponential backoff
 * (5s, 10s, 20s … max 60s). Mount it once, through LiveProvider.
 */
export function useSSE(): SSEState {
  const [dashboardState, setDashboardState] = useState<DashboardState | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>("connecting");
  const [dbUnreachable, setDbUnreachable] = useState(false);
  const [serverStopped, setServerStopped] = useState(false);
  const [retryAt, setRetryAt] = useState<number | null>(null);
  const [retryIn, setRetryIn] = useState<number | null>(null);
  const [revision, setRevision] = useState(0);
  const [receivedAt, setReceivedAt] = useState<number | null>(null);
  const [attempt, setAttempt] = useState(0);
  const backoffRef = useRef(INITIAL_BACKOFF_MS);
  const stoppedRef = useRef(false);

  useEffect(() => {
    let disposed = false;
    let timer: number | null = null;
    const source = new EventSource("/api/sse");
    setConnectionStatus((prev) => (prev === "reconnecting" ? prev : "connecting"));

    source.onopen = () => {
      backoffRef.current = INITIAL_BACKOFF_MS;
      setRetryAt(null);
      setConnectionStatus("connected");
      stoppedRef.current = false;
      setServerStopped(false);
    };

    source.addEventListener("DASHBOARD_UPDATE", (event) => {
      const payload = JSON.parse((event as MessageEvent<string>).data) as SSEEvent<DashboardState>;
      setDashboardState(payload.data);
      setReceivedAt(Date.now());
      setDbUnreachable(false);
      setRevision((value) => value + 1);
    });

    source.addEventListener("SERVER_STOPPED", () => {
      stoppedRef.current = true;
      setServerStopped(true);
    });

    source.addEventListener("DB_UNREACHABLE", () => {
      setDbUnreachable(true);
    });

    source.onerror = () => {
      if (disposed) return;
      source.close();
      const delay = backoffRef.current;
      // After STOP the server comes back when play is pressed: keep checking every 5s.
      backoffRef.current = stoppedRef.current ? INITIAL_BACKOFF_MS : Math.min(delay * 2, MAX_BACKOFF_MS);
      setConnectionStatus("reconnecting");
      setRetryAt(Date.now() + delay);
      timer = window.setTimeout(() => setAttempt((value) => value + 1), delay);
    };

    return () => {
      disposed = true;
      if (timer !== null) window.clearTimeout(timer);
      source.close();
    };
  }, [attempt]);

  useEffect(() => {
    if (retryAt === null) {
      setRetryIn(null);
      return;
    }
    const update = () => setRetryIn(Math.max(0, Math.ceil((retryAt - Date.now()) / 1000)));
    update();
    const interval = window.setInterval(update, 250);
    return () => window.clearInterval(interval);
  }, [retryAt]);

  const reconnect = useCallback(() => {
    backoffRef.current = INITIAL_BACKOFF_MS;
    setRetryAt(null);
    setAttempt((value) => value + 1);
  }, []);

  return { dashboardState, connectionStatus, dbUnreachable, serverStopped, retryIn, revision, receivedAt, reconnect };
}
