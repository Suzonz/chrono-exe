# CHRONO.EXE: architecture

How the pieces fit together, and why they are built this way. For setup and usage, see the [README](../README.md).

## 1. Overview

```
 Chrome                                   Your computer
┌───────────────────────────┐            ┌──────────────────────────────────────────────┐
│ Extension (MV3)           │  heartbeat │ Next.js 14 server (127.0.0.1:3005)            │
│  service worker           │ ─────────► │  API routes (Zod) → categorizer → sessions    │
│  · 30s alarm + tab/app    │  /api/...  │  → SQLite (Prisma) → SSE broadcast            │
│    switch events          │            │                                              │
│  · chrome.idle, audible   │            │  React app: SESSION · HISTORY · SETTINGS      │
│  · popup ▶ ❚❚ ■, badge    │ ◄───────── │  (live snapshots over SSE, reports over REST) │
└────────────┬──────────────┘   pulse    └──────────────────────────────────────────────┘
             │ sendNativeMessage                         ▲ starts (detached)
             ▼                                           │
┌───────────────────────────┐                            │
│ Native launcher           │ ───────────────────────────┘
│ launcher/host.mjs         │  only when ▶ is pressed and no server answers
└───────────────────────────┘
```

Everything runs locally. The database is one file (`prisma/chrono.db`) and no data leaves the machine.

| Part | Role | Code |
| --- | --- | --- |
| Extension | Sensor only: reports what is in front of you, never decides anything | `extension/background.ts`, `extension/popup/` |
| Launcher | Starts the server when ▶ is pressed (Windows) | `launcher/host.mjs`, `scripts/launcher.mjs` |
| API | Validation, categorization, sessions, reports | `src/app/api/*`, `src/lib/*` |
| App | Live dashboard and history | `src/app/*`, `src/components/*`, `src/hooks/*` |

## 2. The extension: a dumb, reliable sensor

Every heartbeat is `{ url, timestamp, idleSeconds, backgroundAudio[] }`.

- **When.** A `chrome.alarms` heartbeat every 30s, plus an immediate one on tab change, navigation and window focus change. These are throttled to one every 3s, so short visits land in the right category.
- **What.** It reports the active tab of the focused window.
  - If Chrome is not focused, it sends the pseudo-URL `chrono://outside.chrome`: you are working in another app.
  - Chrome's own pages (new tab, settings…) become `chrono://chrome.pages`.
- **Idle.** `chrome.idle` with a 60s detection interval. The moment you went idle is kept in `storage.session`, because MV3 service workers are suspended often. The server decides what counts as *away* (the configurable delay, 5 min by default).
- **Background audio.** Audible tabs other than the active one are sent separately. They are shown for information and never counted.
- **Server discovery.** It tries the saved URL first, then `127.0.0.1:3005` and common local ports. `/api/health` must answer `{ app: "CHRONO.EXE" }`, so another local app on the same port is never mistaken for the server.
- **Badge and limits.** Each heartbeat response carries a `pulse`: today's total, the time on the current site, and categories over their limit. The extension updates the badge and shows a notification once a day per category.

## 3. The native launcher

Chrome extensions cannot start programs. [Native messaging](https://developer.chrome.com/docs/extensions/develop/concepts/native-messaging) is the official bridge.

1. `npm run launcher:install` builds the app into `.next-app/`. That folder is separate from `.next/`, so it never clashes with `next dev`.
2. It writes a host manifest and registers it under `HKCU\Software\Google\Chrome\NativeMessagingHosts`, for the current user and without admin rights.
3. Its `allowed_origins` contains only this extension. The ID is stable because `manifest.json` has a fixed public `key`.
4. When ▶ is pressed and no server answers, the extension calls `sendNativeMessage("com.chrono_exe.launcher", { action: "start" })`.
5. The host starts `next start -H 127.0.0.1 -p 3005` **detached** and replies at once. The popup then shows `BOOTING...` while it polls `/api/health` (about 1s).
6. The server runs with `CHRONO_LAUNCHER=1`. With that flag, **■ stop** broadcasts `SERVER_STOPPED` and exits 1.5s later. Pause keeps it running. A server started by hand (`npm run dev`) never stops itself.

The protocol is one length-prefixed JSON message in and one out. Each call is logged in `launcher/host.log`, and the server output goes to `launcher/server.log`.

## 4. Data model (Prisma + SQLite)

| Model | Purpose |
| --- | --- |
| `Category` | Name, color, order, `productivity` (PRODUCTIVE / NEUTRAL / DISTRACTING), optional `dailyLimitSeconds`. System categories `IDLE`, `OTHER` and `OUTSIDE_CHROME` cannot be renamed or deleted |
| `Rule` | Glob pattern (`*.github.com`, `github.com/my-org/*`) → category, evaluated in order |
| `IgnorePattern` | Sites that are never stored |
| `Session` | A continuous stretch in one category: `startedAt`, `endedAt`, `durationSeconds`, `isIdle`, `heartbeatCount` |
| `Heartbeat` | Raw signal: sanitized URL, timestamp, background audio. `@@unique([sessionId, timestamp])` makes replays idempotent. Deleting a session cascades |
| `Settings` | Productive goal, away delay, and the stopwatch state (`trackingState`, `runStartedAt`: when play was pressed, kept across pauses) |

**Privacy.** `sanitizeUrl` drops query strings and fragments before storage, and page titles are never stored. *Settings → YOUR DATA* exports, restores or deletes everything (`/api/data`).

## 5. Ingestion: from heartbeat to session

`POST /api/heartbeat`:

1. **Zod validation**, then a check of the tracking state. Heartbeats are only recorded while **RUNNING**. When paused or stopped, the reply is `{ ignored: true, reason }`.
2. **Ignore list.** It only applies to web pages, and ignored sites are dropped before anything is stored.
3. **Category.**
   - `OUTSIDE_CHROME` for the pseudo-URL.
   - `IDLE` when `idleSeconds ≥ away delay`.
   - The dashboard's own tab continues the current activity instead of breaking it.
   - Otherwise, the first matching rule, or `OTHER`.
4. **Session state machine** (`src/lib/sessionLogic.ts`, pure and unit-tested):

| Situation | Decision |
| --- | --- |
| No open session | **start** |
| Same category, same away state | **extend** |
| Category or away state changed | **switch**: close at this heartbeat, open a new one |
| Silence longer than `SSE_INACTIVITY_THRESHOLD_MS` (2 min) | **gap**: close at last heartbeat + 30s, then start |
| Older than the last heartbeat (late retry) | **stale**: stored, session math untouched |

5. **Broadcast** a fresh dashboard snapshot over SSE, and return the `pulse`.

Gaps are honest: if the laptop sleeps, the session ends where activity really ended, not when the next heartbeat arrives.

## 6. Reports: aggregation

All report math is in `src/lib/aggregate.ts` and `src/lib/hourly.ts`. Both are pure functions over sessions loaded by `src/lib/stats.ts`, so they are tested without a database.

- **Local days.** Day boundaries use local time (`src/lib/time.ts`). A session that crosses midnight is clipped and split between both days.
- **Active time** excludes away (`isIdle`) sessions. Away time is reported separately.
- **Top sites.** A session's duration is split between the hosts it visited, in proportion to their heartbeat counts.
- **Productivity score** = productive seconds / active seconds. The **daily goal** applies to productive time only. Outside Chrome is neutral, so it never inflates the goal.
- **Limits.** A category is flagged when its active time today reaches its limit.
- **Trends.** The previous period (yesterday, last week, last month) is loaded in the same query and aggregated the same way, so `+35m vs yesterday` always compares like with like.
- **Scope.** With `?scope=chrome`, `applyScope` drops `OUTSIDE_CHROME` sessions *before* aggregation. Totals, percentages, scores and trends then all describe the same thing. The INCLUDE OUTSIDE CHROME checkbox drives it, and its value is remembered in `localStorage`.
- **Current session.** A session runs from play to stop, and pause keeps it. Play always starts a new one, also when the server or the computer was shut down without stop. Its totals (`run` in the live snapshot, see `runTotals`) only count recorded time, so pauses and sleep never inflate the stopwatch. Reports for the SESSION page pass `?from=<session start>` to narrow the day to it.
- **Hour by hour.** `hourlyBuckets` clips every session to each hour: active seconds per category plus away seconds. The chart shows an 8h window (12h in HISTORY) that can be scrolled back to 00:00.
- **Background audio.** Each heartbeat that reports audio credits those hosts until the next heartbeat, capped at 30s.

## 7. Real time

- `GET /api/sse` keeps an `EventSource` open. Events are `DASHBOARD_UPDATE` (a full snapshot), `DB_UNREACHABLE` and `SERVER_STOPPED`.
- **Why `globalThis`.** Next.js compiles each route into its own bundle, so module-level state is not shared between `/api/heartbeat` and `/api/sse`. The SSE client registry and the caches (rules, ignore list, shutdown timer) live on `globalThis`, which every route in the process shares.
- A 15s monitor re-broadcasts the snapshot. This closes stale sessions and surfaces "extension offline" even without heartbeats.
- **Client side.**
  - One connection for the whole app (`LiveProvider`), with exponential backoff from 5s to 60s. After `SERVER_STOPPED` it keeps retrying every 5s, so the page comes back on the next ▶.
  - Between snapshots, `useDashboard` keeps the stopwatch and totals ticking locally, never past the point where the server would end the session.
  - Reports refetch on every snapshot (`revision`).

## 8. Front end

| Screen | Content |
| --- | --- |
| SESSION | One screen without scrolling (from 1280px wide): now tracking, top sites, pixel ring with the scope checkbox, productive time with the − / + goal, background audio, hour-by-hour chart. It covers the current session; the TODAY checkbox widens it to the whole day |
| HISTORY | DAY / WEEK / MONTH, each with the ring, productivity, top sites and background audio. DAY adds the hour chart and an activity log with CSV export, WEEK stacked day bars, MONTH a heatmap calendar |
| SETTINGS | Categories (type, color, limit), site rules with a live URL tester, ignored sites, preferences, your data |

The visual rules are in [UI_GUIDELINES.md](UI_GUIDELINES.md).

## 9. Quality

- **Unit tests** cover the pure logic: glob matching, session state machine, aggregation, scope, hourly buckets and launcher lifecycle.
- **Integration test** (`__tests__/api/flow.test.ts`). It runs the real route handlers on a throwaway SQLite file (`prisma/test.db`), from "press play" to "restore a backup", including rules, ignore list, scope and settings.
- **Coverage** is about 86% of `src/lib` and `src/app/api`, and CI enforces 80%. The React app and the extension are checked manually and through screenshots, not unit-tested.
- **CI** (`.github/workflows/ci.yml`): `npm ci` → Prisma generate → lint → typecheck (app and extension) → tests with coverage → `next build` → extension build.

## 10. Decisions and trade-offs

| Decision | Why | Cost |
| --- | --- | --- |
| Local server, not an extension-only app | Real database, real API, shared by the dashboard and the extension. It is also the portfolio point | Something must run, which the launcher solves |
| SQLite instead of MySQL in Docker | One file, no service to install, trivial backup | A single writer, which is fine for one user |
| Server owns all logic, extension is a sensor | One place to test. Extension updates are rare | Needs the server to categorize |
| Native messaging launcher | The only supported way for an extension to start a program | Windows-only for now. Registration is a one-time step |
| Split site time by heartbeat counts | Sessions are per category, not per site, which keeps the table small | 30s resolution per site |
| Scope applied before aggregation | Every figure on the page stays consistent | One extra query parameter |

## 11. Directory map

```
src/app/            pages + API routes
src/components/     layout, providers, report blocks (TimeRing, ProductiveCounter, DayTimeline…), UI kit
src/hooks/          useSSE, useDashboard, useApi, useIncludeOutside, useDateParam, useNow
src/lib/            pure logic (sessionLogic, aggregate, hourly, scope, glob, summary, time) and data access
extension/          Chrome MV3 extension (TypeScript sources + compiled .js)
launcher/           native messaging host
prisma/             schema, migrations, seed, demo data
scripts/            launcher install, icon generator, README screenshots
__tests__/          unit (lib) and integration (api) tests
```
