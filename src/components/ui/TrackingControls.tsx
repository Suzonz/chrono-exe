"use client";

import { useState } from "react";
import type { TrackingAction, TrackingState } from "@/types";
import { apiFetch, toApiError } from "@/hooks/useApi";
import { PixelIcon, type PixelIconName } from "@/components/ui/PixelIcon";

/**
 * Big square arcade buttons with a pixel-art icon only (labels stay in
 * aria-label/title). Hard drop shadow; the button sinks into it when pressed.
 */
const arcade =
  "grid place-items-center border-2 shadow-[5px_5px_0_0_#000] transition-[transform,box-shadow,opacity] duration-75 enabled:hover:brightness-110 enabled:active:translate-x-[5px] enabled:active:translate-y-[5px] enabled:active:shadow-none disabled:cursor-not-allowed disabled:opacity-25 disabled:shadow-none";
const SIZES = { lg: { box: "h-16 w-16 sm:h-20 sm:w-20", icon: "sm:h-10 sm:w-10", px: 32 }, sm: { box: "h-12 w-12", icon: "", px: 22 } } as const;

const BUTTONS: { action: TrackingAction; icon: PixelIconName; label: string; colors: string }[] = [
  { action: "start", icon: "play", label: "Start", colors: "border-secondary-fixed bg-secondary-fixed text-on-secondary" },
  { action: "pause", icon: "pause", label: "Pause", colors: "border-tertiary bg-tertiary text-on-tertiary" },
  { action: "stop", icon: "stop", label: "Stop", colors: "border-error bg-error-container text-on-error-container" }
];

function isEnabled(action: TrackingAction, state: TrackingState): boolean {
  if (action === "start") return state !== "RUNNING";
  if (action === "pause") return state === "RUNNING";
  return state !== "STOPPED";
}

/** ▶/❚❚ toggle + ■ — the server pushes the new state to every open view. */
export function TrackingControls({ state, disabled = false, size = "lg" }: { state: TrackingState; disabled?: boolean; size?: keyof typeof SIZES }) {
  const dims = SIZES[size];
  const [busy, setBusy] = useState<TrackingAction | null>(null);
  const [error, setError] = useState<string | null>(null);

  // One play/pause toggle (shows ▶ when stopped or paused, ❚❚ while running) + stop.
  const toggle = BUTTONS[state === "RUNNING" ? 1 : 0];
  const stop = BUTTONS[2];

  const run = async (action: TrackingAction) => {
    setBusy(action);
    setError(null);
    try {
      await apiFetch("/api/tracking", { method: "POST", body: JSON.stringify({ action }) });
    } catch (err) {
      setError(toApiError(err).message.toUpperCase());
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="flex flex-col items-center gap-md">
      <div className={`flex justify-center ${size === "sm" ? "gap-md" : "gap-lg"}`} role="group" aria-label="Tracking controls">
        {[toggle, stop].map((button) => {
          const label = button.action === "start" && state === "PAUSED" ? "Resume" : button.label;
          return (
            <button
              key={button.action === "stop" ? "stop" : "toggle"}
              type="button"
              aria-label={label}
              title={label}
              disabled={disabled || busy !== null || !isEnabled(button.action, state)}
              onClick={() => void run(button.action)}
              className={`${arcade} ${dims.box} ${button.colors} ${busy === button.action ? "animate-blink" : ""}`}
            >
              <PixelIcon name={button.icon} size={dims.px} className={dims.icon} />
            </button>
          );
        })}
      </div>
      {error ? (
        <div role="alert" className="text-ui-small text-error">
          &gt; ERR: {error}
        </div>
      ) : null}
    </div>
  );
}
