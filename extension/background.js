/**
 * CHRONO.EXE — background service worker (Manifest V3).
 *
 * Every 30s: read the active tab, measure how long the user has been idle,
 * POST a heartbeat to `<apiUrl>/api/heartbeat`. The server owns all logic
 * (categorization, sessions); the extension is a dumb, reliable sensor.
 */
const ALARM = "chrono-heartbeat";
const DEFAULT_API_URL = "http://localhost:3000";
const IDLE_DETECTION_SECONDS = 60;
const MAX_ATTEMPTS = 3;
const RETRY_DELAY_MS = 5000;
// ─── Badge: today's active time on the toolbar icon ─────────────────────
const BADGE_COLORS = { RUNNING: "#0f9d7a", PAUSED: "#c2660a", STOPPED: "#5f5a66" };
/** "45m", "3h", "3h4" (badges fit ~4 characters). */
function badgeText(seconds) {
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60)
        return `${minutes}m`;
    const hours = Math.floor(minutes / 60);
    const rest = minutes % 60;
    return hours >= 10 || rest < 6 ? `${hours}h` : `${hours}h${Math.floor(rest / 6)}`;
}
async function updateBadge(state, todaySeconds) {
    await chrome.action.setBadgeBackgroundColor({ color: BADGE_COLORS[state] });
    await chrome.action.setBadgeTextColor?.({ color: "#ffffff" });
    // Stopped: no badge. Running/paused: today's active time.
    await chrome.action.setBadgeText({ text: state === "STOPPED" ? "" : state === "PAUSED" ? "II" : badgeText(todaySeconds) });
    await chrome.action.setTitle({ title: `CHRONO.EXE · ${state}` });
}
// ─── Daily limits: one notification per category per day ───────────────
function formatShort(seconds) {
    const minutes = Math.round(seconds / 60);
    return minutes >= 60 ? `${Math.floor(minutes / 60)}h${String(minutes % 60).padStart(2, "0")}` : `${minutes} min`;
}
async function notifyLimits(alerts) {
    if (alerts.length === 0)
        return;
    const today = new Date().toDateString();
    const { notifiedLimits } = await chrome.storage.local.get("notifiedLimits");
    const seen = typeof notifiedLimits === "object" && notifiedLimits ? notifiedLimits : {};
    for (const alert of alerts) {
        if (seen[alert.category.id] === today)
            continue;
        seen[alert.category.id] = today;
        chrome.notifications.create(`limit-${alert.category.id}-${Date.now()}`, {
            type: "basic",
            iconUrl: "icons/icon128.png",
            title: "WARNING: LIMIT REACHED",
            message: `${alert.category.name} · ${formatShort(alert.usedSeconds)} today (limit ${formatShort(alert.limitSeconds)})`,
            priority: 2
        });
    }
    await chrome.storage.local.set({ notifiedLimits: seen });
}
async function applyPulse(state, pulse) {
    if (!pulse)
        return;
    await updateBadge(state, pulse.todayTrackedSeconds);
    await chrome.storage.local.set({ todayTotalSeconds: pulse.todayTrackedSeconds, currentSite: pulse.site });
    if (state === "RUNNING")
        await notifyLimits(pulse.limitAlerts);
}
/** Ports scanned when the configured endpoint is not a CHRONO.EXE server. */
const LAUNCHER_URL = "http://127.0.0.1:3005";
const CANDIDATE_URLS = [LAUNCHER_URL, ...[3000, 3001, 3002, 3003, 3005, 3010, 4000, 5000, 8000, 8080].map((port) => `http://localhost:${port}`)];
async function getApiUrl() {
    const { apiUrl } = await chrome.storage.local.get("apiUrl");
    const value = typeof apiUrl === "string" && apiUrl.trim() ? apiUrl.trim() : DEFAULT_API_URL;
    return value.replace(/\/+$/, "");
}
/** True when `url` answers `/api/health` as CHRONO.EXE (another local app on the port does not count). */
async function isChronoServer(url) {
    try {
        const response = await fetch(`${url}/api/health`, { signal: AbortSignal.timeout(1500) });
        if (!response.ok)
            return false;
        const body = (await response.json());
        return body.app === "CHRONO.EXE";
    }
    catch {
        return false;
    }
}
/**
 * Finds the dashboard: the configured URL first, then common local ports.
 * The URL found is saved so the popup shows it and later heartbeats use it.
 */
async function discoverApiUrl(current) {
    if (await isChronoServer(current))
        return current;
    for (const candidate of CANDIDATE_URLS) {
        if (candidate !== current && (await isChronoServer(candidate))) {
            await chrome.storage.local.set({ apiUrl: candidate });
            return candidate;
        }
    }
    return null;
}
// ─── Idle tracking ──────────────────────────────────────────────────
// chrome.idle only says "idle" after the detection interval, so the moment the
// user went idle is (state change time − interval). Persisted in session
// storage because MV3 service workers are frequently suspended.
async function markIdle(state) {
    if (state === "active") {
        await chrome.storage.session.remove("idleSince");
        return;
    }
    const { idleSince } = await chrome.storage.session.get("idleSince");
    if (typeof idleSince !== "number") {
        await chrome.storage.session.set({ idleSince: Date.now() - IDLE_DETECTION_SECONDS * 1000 });
    }
}
async function getIdleSeconds() {
    const state = await chrome.idle.queryState(IDLE_DETECTION_SECONDS);
    await markIdle(state);
    if (state === "active")
        return 0;
    const { idleSince } = await chrome.storage.session.get("idleSince");
    return typeof idleSince === "number" ? Math.max(0, Math.floor((Date.now() - idleSince) / 1000)) : IDLE_DETECTION_SECONDS;
}
// ─── Heartbeat ──────────────────────────────────────────────────────
async function getActiveTab() {
    const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
    return tab ?? null;
}
/** Web pages only. The dashboard tab is still sent: the server knows it and handles it. */
function isTrackable(url) {
    return Boolean(url && /^https?:\/\//i.test(url));
}
/** Pseudo-addresses for what is not a web page. */
const OUTSIDE_CHROME_URL = "chrono://outside.chrome";
const CHROME_PAGE_URL = "chrono://chrome.pages";
function hostOf(url) {
    try {
        return url ? new URL(url).host.toLowerCase().replace(/^www\./, "") : null;
    }
    catch {
        return null;
    }
}
/** True when a Chrome window has the OS focus (false while you use another app). */
async function isChromeFocused() {
    try {
        const win = await chrome.windows.getLastFocused();
        return win.focused === true;
    }
    catch {
        return false;
    }
}
/** Sites playing sound in tabs other than the one you are looking at. */
async function backgroundAudioHosts(activeTabId) {
    const audible = await chrome.tabs.query({ audible: true });
    const hosts = audible.filter((tab) => tab.id !== activeTabId).map((tab) => hostOf(tab.url)).filter((host) => Boolean(host));
    return Array.from(new Set(hosts)).slice(0, 10);
}
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
async function post(apiUrl, payload) {
    let lastError = "Unknown error";
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
        try {
            const response = await fetch(`${apiUrl}/api/heartbeat`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload)
            });
            if (response.ok) {
                return (await response.json());
            }
            const body = (await response.json().catch(() => null));
            lastError = body?.code ?? `HTTP ${response.status}`;
            if (response.status >= 400 && response.status < 500)
                break; // invalid payload: retrying will not help
        }
        catch {
            lastError = "SERVER_UNREACHABLE";
        }
        if (attempt < MAX_ATTEMPTS)
            await sleep(RETRY_DELAY_MS);
    }
    throw new Error(lastError);
}
let sending = false;
async function sendHeartbeat() {
    if (sending)
        return;
    sending = true;
    try {
        await doSendHeartbeat();
    }
    finally {
        lastSentAt = Date.now();
        sending = false;
    }
}
async function doSendHeartbeat() {
    const focused = await isChromeFocused();
    const tab = focused ? await getActiveTab() : null;
    // Chrome in the background: you are using another app. Chrome internal pages
    // (new tab, settings…) are grouped together.
    const url = !focused ? OUTSIDE_CHROME_URL : isTrackable(tab?.url) ? tab.url : CHROME_PAGE_URL;
    const title = !focused ? "Outside Chrome" : isTrackable(tab?.url) ? tab.title ?? "" : "Chrome page";
    const payload = {
        url,
        title,
        timestamp: new Date().toISOString(),
        idleSeconds: await getIdleSeconds(),
        backgroundAudio: await backgroundAudioHosts(focused ? tab?.id : undefined)
    };
    try {
        let apiUrl = await getApiUrl();
        let result;
        try {
            result = await post(apiUrl, payload);
        }
        catch (error) {
            // Wrong port (another app answered, or nothing listens): look for the real server.
            const found = await discoverApiUrl(apiUrl);
            if (!found || found === apiUrl)
                throw error;
            apiUrl = found;
            result = await post(apiUrl, payload);
        }
        await chrome.storage.local.set({
            connectionStatus: "connected",
            lastHeartbeatAt: Date.now(),
            lastError: null,
            trackingNote: result.ignored ? "CURRENT TAB IS IGNORED" : null,
            currentCategory: result.ignored ? null : result.categoryName ?? null,
            currentColor: result.ignored ? null : result.categoryColor ?? null
        });
        await applyPulse(result.trackingState, result.pulse);
    }
    catch (error) {
        await chrome.storage.local.set({
            connectionStatus: "disconnected",
            lastError: error instanceof Error ? error.message : String(error)
        });
    }
}
// ─── Wiring ─────────────────────────────────────────────────────────
function ensureAlarm() {
    chrome.alarms.get(ALARM, (existing) => {
        if (!existing)
            chrome.alarms.create(ALARM, { periodInMinutes: 0.5, delayInMinutes: 0.5 });
    });
}
chrome.idle.setDetectionInterval(IDLE_DETECTION_SECONDS);
chrome.idle.onStateChanged.addListener((state) => void markIdle(state));
chrome.runtime.onInstalled.addListener(() => {
    ensureAlarm();
    void sendHeartbeat();
});
chrome.runtime.onStartup.addListener(() => {
    ensureAlarm();
    void sendHeartbeat();
});
chrome.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === ALARM)
        void sendHeartbeat();
});
// ─── Instant updates: tab switch, navigation, focus change ──────────
// Between two 30s heartbeats, switching tab or app sends one right away, so
// short visits land in the right category. Throttled to one every 3s.
const MIN_GAP_MS = 3000;
let lastSentAt = 0;
let pending = null;
function scheduleHeartbeat() {
    if (pending)
        return;
    const wait = Math.max(0, lastSentAt + MIN_GAP_MS - Date.now());
    pending = setTimeout(() => {
        pending = null;
        void sendHeartbeat();
    }, wait + 300);
}
chrome.tabs.onActivated.addListener(() => scheduleHeartbeat());
chrome.tabs.onUpdated.addListener((_tabId, changeInfo, tab) => {
    if (tab.active && (changeInfo.url || changeInfo.audible !== undefined))
        scheduleHeartbeat();
});
chrome.windows.onFocusChanged.addListener(() => scheduleHeartbeat());
// ─── Native launcher: start the server when play is pressed ─────────
// Extensions cannot start programs. The launcher (launcher/host.mjs, installed
// with `npm run launcher:install`) is a small program Chrome runs for us.
const LAUNCHER = "com.chrono_exe.launcher";
const BOOT_TIMEOUT_MS = 45000;
/** null when the launcher is not installed. */
function askLauncher(message) {
    return new Promise((resolve) => {
        try {
            chrome.runtime.sendNativeMessage(LAUNCHER, message, (reply) => {
                resolve(chrome.runtime.lastError || !reply ? null : reply);
            });
        }
        catch {
            resolve(null);
        }
    });
}
/** Cached for the browser session: pinging spawns a process. */
async function hasLauncher() {
    const { launcher } = await chrome.storage.session.get("launcher");
    if (typeof launcher === "boolean")
        return launcher;
    const available = (await askLauncher({ action: "ping" }))?.ok === true;
    await chrome.storage.session.set({ launcher: available });
    return available;
}
async function bootServer() {
    const reply = await askLauncher({ action: "start" });
    await chrome.storage.session.set({ launcher: reply !== null });
    if (!reply)
        return { error: "SERVER OFF. RUN npm run launcher:install ONCE (OR npm run dev)." };
    if (!reply.ok || !reply.url) {
        return { error: reply.error === "NOT_BUILT" ? "APP NOT BUILT. RUN npm run launcher:install." : `LAUNCHER ERROR: ${reply.error ?? "UNKNOWN"}` };
    }
    const deadline = Date.now() + BOOT_TIMEOUT_MS;
    while (Date.now() < deadline) {
        if (await isChronoServer(reply.url)) {
            await chrome.storage.local.set({ apiUrl: reply.url });
            return { url: reply.url };
        }
        await sleep(700);
    }
    return { error: "THE SERVER DID NOT START. SEE launcher/server.log." };
}
async function callTracking(action) {
    let apiUrl = await discoverApiUrl(await getApiUrl());
    if (!apiUrl && action === "start") {
        await chrome.storage.session.set({ booting: true });
        const booted = await bootServer();
        await chrome.storage.session.remove("booting");
        if ("error" in booted) {
            await chrome.storage.local.set({ connectionStatus: "disconnected", lastError: booted.error });
            return { ok: false, error: booted.error, off: true, launcher: (await chrome.storage.session.get("launcher")).launcher === true };
        }
        apiUrl = booted.url;
    }
    if (!apiUrl) {
        // Server off. With the launcher installed this is normal: play starts it.
        const launcher = await hasLauncher();
        await chrome.storage.local.set({ connectionStatus: "disconnected", lastError: "SERVER OFF" });
        await updateBadge("STOPPED", 0);
        return { ok: false, off: true, launcher, error: launcher ? null : "SERVER OFF. RUN npm run launcher:install ONCE (OR npm run dev)." };
    }
    try {
        const tab = await getActiveTab();
        const page = isTrackable(tab?.url) ? { url: tab.url, title: tab.title ?? "" } : null;
        const failure = async (response) => {
            const body = (await response.json().catch(() => null));
            return { ok: false, error: body?.code === "DB_UNREACHABLE" ? "DATABASE UNREACHABLE" : body?.message ?? `HTTP ${response.status}` };
        };
        if (action) {
            const posted = await fetch(`${apiUrl}/api/tracking`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ action, ...(page ?? {}) })
            });
            if (!posted.ok)
                return failure(posted);
        }
        // Fresh state + today at a glance for the current tab's site.
        const query = page ? `?url=${encodeURIComponent(page.url)}` : "";
        const response = await fetch(`${apiUrl}/api/tracking${query}`);
        if (!response.ok)
            return failure(response);
        const body = (await response.json());
        await chrome.storage.local.set({ connectionStatus: "connected", lastError: null });
        await applyPulse(body.tracking.state, body.pulse);
        return { ok: true, data: body, apiUrl };
    }
    catch {
        await chrome.storage.local.set({ connectionStatus: "disconnected", lastError: "SERVER_UNREACHABLE" });
        return { ok: false, error: "SERVER UNREACHABLE" };
    }
}
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message?.type === "chrono:heartbeat-now") {
        void sendHeartbeat().then(() => sendResponse({ ok: true }));
        return true; // async response
    }
    if (message?.type === "chrono:status") {
        void callTracking().then(sendResponse);
        return true;
    }
    if (message?.type === "chrono:control" && message.action) {
        void callTracking(message.action).then(sendResponse);
        return true;
    }
    return false;
});
ensureAlarm();
export {};
