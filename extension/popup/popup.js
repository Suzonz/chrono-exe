/**
 * CHRONO.EXE — extension popup: START / PAUSE / STOP, live stopwatch,
 * current category and today's total. The server is auto-detected.
 */
const PALETTE = {
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
};
function icon(name) {
    const rects = SPRITES[name]
        .flatMap((row, y) => Array.from(row).map((cell, x) => (cell === "X" ? `<rect x="${x}" y="${y}" width="1" height="1"/>` : "")))
        .join("");
    return `<svg viewBox="0 0 7 7" aria-hidden="true">${rects}</svg>`;
}
let snapshot = null;
let receivedAt = 0;
let apiUrl = null;
let busy = false;
function $(id) {
    const element = document.getElementById(id);
    if (!element)
        throw new Error(`Missing #${id}`);
    return element;
}
function formatDuration(seconds) {
    const total = Math.max(0, Math.floor(seconds));
    const h = String(Math.floor(total / 3600)).padStart(2, "0");
    const m = String(Math.floor((total % 3600) / 60)).padStart(2, "0");
    const s = String(total % 60).padStart(2, "0");
    return `${h}:${m}:${s}`;
}
function send(message) {
    return new Promise((resolve) => {
        chrome.runtime.sendMessage(message, (reply) => {
            resolve(reply ?? { ok: false, error: "EXTENSION ERROR" });
        });
    });
}
function showError(message) {
    const note = $("note");
    note.textContent = message ? `> ${message}` : "";
    note.hidden = !message;
}
function apply(reply) {
    if (reply.ok) {
        snapshot = reply.data;
        receivedAt = Date.now();
        apiUrl = reply.apiUrl;
        showError(null);
        $("status").textContent = "CONNECTED";
        $("status").className = "ok";
    }
    else {
        showError(reply.error);
        $("status").textContent = "NOT FOUND";
        $("status").className = "err";
    }
    render();
}
function render() {
    const state = snapshot?.tracking.state ?? "STOPPED";
    const css = state === "RUNNING" ? "running" : state === "PAUSED" ? "paused" : "";
    const stateLabel = $("state");
    stateLabel.innerHTML = snapshot ? `${icon(state === "RUNNING" ? "play" : state === "PAUSED" ? "pause" : "stop")}<span>${state}</span>` : "...";
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
    }
    else {
        name.textContent = state === "PAUSED" ? "PAUSED" : state === "RUNNING" ? "WAITING..." : "READY";
        name.style.color = "";
        swatch.hidden = true;
    }
    // One play/pause toggle: ▶ while stopped or paused, ❚❚ while running.
    const toggle = $("toggle");
    const toggleIcon = state === "RUNNING" ? "pause" : "play";
    if (toggle.dataset.icon !== toggleIcon) {
        toggle.innerHTML = icon(toggleIcon);
        toggle.dataset.icon = toggleIcon;
    }
    const toggleLabel = state === "RUNNING" ? "Pause" : state === "PAUSED" ? "Resume" : "Start";
    toggle.setAttribute("aria-label", toggleLabel);
    toggle.title = toggleLabel;
    toggle.className = state === "RUNNING" ? "pause" : "";
    toggle.disabled = busy || !snapshot;
    $("stop").disabled = busy || !snapshot || state === "STOPPED";
    $("total").textContent = formatDuration(snapshot?.totalTrackedSeconds ?? 0);
    const site = snapshot?.pulse?.site;
    $("site-name").textContent = site ? site.host : "This site";
    $("site-time").textContent = site ? formatDuration(site.todaySeconds) : "--";
    const alerts = snapshot?.pulse?.limitAlerts ?? [];
    const limits = $("limits");
    limits.textContent = alerts.map((alert) => `! ${alert.category.name} LIMIT REACHED (${Math.round(alert.limitSeconds / 60)} MIN)`).join(" · ");
    limits.hidden = alerts.length === 0;
}
async function refresh() {
    apply(await send({ type: "chrono:status" }));
}
async function control(action) {
    busy = true;
    render();
    const reply = await send({ type: "chrono:control", action });
    busy = false;
    apply(reply);
}
// Big icon-only buttons: ▶/❚❚ toggle + ■ (labels live in aria-label / title).
$("stop").innerHTML = icon("stop");
$("toggle").addEventListener("click", () => void control(snapshot?.tracking.state === "RUNNING" ? "pause" : "start"));
$("stop").addEventListener("click", () => void control("stop"));
$("open").addEventListener("click", () => {
    void chrome.tabs.create({ url: apiUrl ?? "http://localhost:3000" });
});
$("config").addEventListener("submit", (event) => {
    event.preventDefault();
    const value = $("api-url").value.trim().replace(/\/+$/, "");
    void chrome.storage.local.set({ apiUrl: value || "http://localhost:3000" }).then(refresh);
});
void chrome.storage.local.get("apiUrl").then(({ apiUrl: saved }) => {
    if (typeof saved === "string")
        $("api-url").value = saved;
});
window.setInterval(render, 1000);
window.setInterval(() => void refresh(), 5000);
void refresh();
export {};
