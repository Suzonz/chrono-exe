"use client";

import { createContext, useContext, type ReactNode } from "react";
import { useSSE, type SSEState } from "@/hooks/useSSE";

const LiveContext = createContext<SSEState | null>(null);

/** Owns the app-wide SSE connection so every page and the shell share one stream. */
export function LiveProvider({ children }: { children: ReactNode }) {
  const state = useSSE();
  return <LiveContext.Provider value={state}>{children}</LiveContext.Provider>;
}

/** Same as useLive, but null outside the provider (for shared UI pieces). */
export function useOptionalLive(): SSEState | null {
  return useContext(LiveContext);
}

export function useLive(): SSEState {
  const context = useContext(LiveContext);
  if (!context) {
    throw new Error("useLive must be used inside <LiveProvider>");
  }
  return context;
}
