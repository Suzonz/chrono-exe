/**
 * Server lifecycle when started by the native launcher (launcher/host.mjs).
 *
 * The launcher sets CHRONO_LAUNCHER=1: pressing play started the server, so
 * pressing stop shuts it down. A server started by hand (npm run dev / start)
 * never stops itself.
 */

const SHUTDOWN_DELAY_MS = 1500;

export function isLauncherManaged(): boolean {
  return process.env.CHRONO_LAUNCHER === "1";
}

const store = globalThis as unknown as { __chronoShutdown?: ReturnType<typeof setTimeout> };

/** Exits the process shortly, after the STOP response and the SSE event are sent. */
export function scheduleShutdown(exit: () => void = () => process.exit(0), delayMs = SHUTDOWN_DELAY_MS): boolean {
  if (store.__chronoShutdown) return false;
  store.__chronoShutdown = setTimeout(exit, delayMs);
  return true;
}
