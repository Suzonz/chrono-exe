/**
 * CHRONO.EXE — extension popup: START / PAUSE / STOP, live stopwatch,
 * current category and today's total. The server is auto-detected.
 */

export {};

type TrackingState = "RUNNING" | "PAUSED" | "STOPPED";

interface Snapshot {
  tracking: { state: TrackingState; runStartedAt: string | null; accumulatedSeconds: number };
  activeSession: { categoryName: string; categoryColor: string; isIdle: boolean } | null;
  totalTrackedSeconds: number;
  generatedAt: string;
  pulse: {
    todayTrackedSeconds: number;
    site: { host: string; todaySeconds: number } | null;
    limitAlerts: { category: { name: string }; usedSeconds: number; limitSeconds: number }[];
  } | null;
}

type Reply =
  | { ok: true; data: Snapshot; apiUrl: string }
  | { ok: false; error: string | null; off?: boolean; launcher?: boolean };

const PALETTE: Record<string, string> = {
  violet: "#a78bfa",
  cyan: "#22d3ee",
  green: "#4ade80",
  amber: "#fbbf24",
  red: "#f87171",
  pink: "#f472b6",
  orange: "#fb923c",
  teal: "#2dd4bf",
  indigo: "#818cf8",
  lime: "#a3e635",
  yellow: "#fde047",
  rose: "#fb7185",
  sky: "#38bdf8",
  emerald: "#34d399",
  fuchsia: "#e879f9",
  slate: "#64748b"
};

// Same 7×7 pixel-art sprites as the dashboard (src/components/ui/PixelIcon.tsx).
const SPRITES = {
  play: ["X......", "XXX....", "XXXXX..", "XXXXXXX", "XXXXX..", "XXX....", "X......"],
  pause: [".XX.XX.", ".XX.XX.", ".XX.XX.", ".XX.XX.", ".XX.XX.", ".XX.XX.", ".XX.XX."],
  stop: [".......", ".XXXXX.", ".XXXXX.", ".XXXXX.", ".XXXXX.", ".XXXXX.", "......."]
} as const;

function icon(name: keyof typeof SPRITES): string {
  const rects = SPRITES[name]
    .flatMap((row, y) => Array.from(row).map((cell, x) => (cell === "X" ? `<rect x="${x}" y="${y}" width="1" height="1"/>` : "")))
    .join("");
  return `<svg viewBox="0 0 7 7" aria-hidden="true">${rects}</svg>`;
}

let snapshot: Snapshot | null = null;
let receivedAt = 0;
let apiUrl: string | null = null;
let busy = false;
/** Server not running. With the launcher installed, play starts it. */
let serverOff = false;
let canBoot = false;
let booting = false;

function $(id: string): HTMLElement {
  const element = document.getElementById(id);
  if (!element) throw new Error(`Missing #${id}`);
  return element;
}

function formatDuration(seconds: number): string {
  const total = Math.max(0, Math.floor(seconds));
  const h = String(Math.floor(total / 3600)).padStart(2, "0");
  const m = String(Math.floor((total % 3600) / 60)).padStart(2, "0");
  const s = String(total % 60).padStart(2, "0");
  return `${h}:${m}:${s}`;
}

function send(message: object): Promise<Reply> {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage(message, (reply: Reply | undefined) => {
      resolve(reply ?? { ok: false, error: "EXTENSION ERROR" });
    });
  });
}

function showError(message: string | null): void {
  const note = $("note");
  note.textContent = message ? `> ${message}` : "";
  note.hidden = !message;
}

function apply(reply: Reply): void {
  if (reply.ok) {
    snapshot = reply.data;
    receivedAt = Date.now();
    apiUrl = reply.apiUrl;
    showError(null);
    $("status").textContent = "CONNECTED";
    $("status").className = "ok";
  } else {
    snapshot = null;
    serverOff = reply.off === true;
    canBoot = reply.launcher === true;
    showError(reply.error);
    $("status").textContent = serverOff ? "OFF" : "NOT FOUND";
    $("status").className = serverOff && canBoot ? "" : "err";
  }
  if (reply.ok) serverOff = false;
  render();
}

function render(): void {
  const state: TrackingState = snapshot?.tracking.state ?? "STOPPED";
  const css = state === "RUNNING" ? "running" : state === "PAUSED" ? "paused" : "";

  const stateLabel = $("state");
  stateLabel.innerHTML = snapshot
    ? `${icon(state === "RUNNING" ? "play" : state === "PAUSED" ? "pause" : "stop")}<span>${state}</span>`
    : booting
      ? "<span>BOOTING...</span>"
      : serverOff
        ? `${icon("stop")}<span>OFF</span>`
        : "...";
  stateLabel.className = css;

  // Stopwatch: accumulated time + current running stretch (ticks locally).
  let seconds = snapshot?.tracking.accumulatedSeconds ?? 0;
  if (snapshot && state === "RUNNING" && snapshot.tracking.runStartedAt) {
    const serverNow = new Date(snapshot.generatedAt).getTime() + (Date.now() - receivedAt);
    seconds += Math.floor((serverNow - new Date(snapshot.tracking.runStartedAt).getTime()) / 1000);
  }
  const clock = $("clock");
  clock.textContent = formatDuration(seconds);
  clock.className = css;

  const active = snapshot?.activeSession;
  const swatch = $("swatch");
  const name = $("category-name");
  if (state === "RUNNING" && active) {
    const color = PALETTE[active.categoryColor] ?? PALETTE.slate;
    name.textContent = active.categoryName;
    name.style.color = color;
    swatch.style.backgroundColor = color;
    swatch.hidden = false;
  } else {
    name.textContent = booting
      ? "STARTING SERVER..."
      : !snapshot && serverOff
        ? canBoot ? "PRESS PLAY" : "SERVER OFF"
        : state === "PAUSED" ? "PAUSED" : state === "RUNNING" ? "WAITING..." : "READY";
    name.style.color = "";
    swatch.hidden = true;
  }

  // One play/pause toggle: ▶ while stopped or paused, ❚❚ while running.
  const toggle = $("toggle") as HTMLButtonElement;
  const toggleIcon = state === "RUNNING" ? "pause" : "play";
  if (toggle.dataset.icon !== toggleIcon) {
    toggle.innerHTML = icon(toggleIcon);
    toggle.dataset.icon = toggleIcon;
  }
  const toggleLabel = state === "RUNNING" ? "Pause" : state === "PAUSED" ? "Resume" : "Start";
  toggle.setAttribute("aria-label", toggleLabel);
  toggle.title = toggleLabel;
  toggle.className = state === "RUNNING" ? "pause" : "";
  toggle.disabled = busy || (!snapshot && !(serverOff && canBoot));
  ($("stop") as HTMLButtonElement).disabled = busy || !snapshot || state === "STOPPED";
  ($("open") as HTMLButtonElement).disabled = !snapshot;

  $("total").textContent = formatDuration(snapshot?.totalTrackedSeconds ?? 0);

  const site = snapshot?.pulse?.site;
  $("site-name").textContent = site ? site.host : "This site";
  $("site-time").textContent = site ? formatDuration(site.todaySeconds) : "--";

  const alerts = snapshot?.pulse?.limitAlerts ?? [];
  const limits = $("limits");
  limits.textContent = alerts.map((alert) => `! ${alert.category.name} LIMIT REACHED (${Math.round(alert.limitSeconds / 60)} MIN)`).join(" · ");
  limits.hidden = alerts.length === 0;
}

async function refresh(): Promise<void> {
  apply(await send({ type: "chrono:status" }));
}

async function control(action: "start" | "pause" | "stop"): Promise<void> {
  busy = true;
  booting = action === "start" && !snapshot;
  if (booting) $("status").textContent = "STARTING...";
  render();
  const reply = await send({ type: "chrono:control", action });
  busy = false;
  booting = false;
  apply(reply);
}

// Big icon-only buttons: ▶/❚❚ toggle + ■ (labels live in aria-label / title).
$("stop").innerHTML = icon("stop");
$("toggle").addEventListener("click", () => void control(snapshot?.tracking.state === "RUNNING" ? "pause" : "start"));
$("stop").addEventListener("click", () => void control("stop"));

$("open").addEventListener("click", () => {
  if (!snapshot) return;
  void chrome.tabs.create({ url: apiUrl ?? "http://localhost:3000" });
});

$("config").addEventListener("submit", (event) => {
  event.preventDefault();
  const value = ($("api-url") as HTMLInputElement).value.trim().replace(/\/+$/, "");
  void chrome.storage.local.set({ apiUrl: value || "http://localhost:3000" }).then(refresh);
});

void chrome.storage.local.get("apiUrl").then(({ apiUrl: saved }) => {
  if (typeof saved === "string") ($("api-url") as HTMLInputElement).value = saved;
});

window.setInterval(render, 1000);
window.setInterval(() => {
  if (!busy) void refresh();
}, 5000);
void refresh();
