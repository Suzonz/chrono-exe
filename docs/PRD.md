# CHRONO.EXE — Product Requirements Document

**Version:** 1.0.0  
**Status:** Draft  
**Last Updated:** 2026-05-06  
**Author:** Senior Product Architect  

---

## 1. Product Vision

CHRONO.EXE is a real-time, solo time-tracking web application with a retro terminal aesthetic. It passively monitors developer activity through a custom Chrome extension, categorizes time automatically based on user-defined rules, and presents actionable insights through a dark, pixel-font interface styled in violet, cyan, and green.

The product is designed for individual developers and knowledge workers who want deep awareness of how they spend their screen time — without manual input, timers, or friction.

**Core promise:** Open your browser, run the extension, and CHRONO.EXE silently logs everything. Review your day like reading a system log.

---

## 2. Objectives

| # | Objective | Metric |
|---|-----------|--------|
| O1 | Passive, zero-friction time capture | 0 manual entries required |
| O2 | Accurate categorization | ≥ 90% of sessions auto-categorized |
| O3 | Real-time dashboard feedback | Data lag ≤ 5 seconds |
| O4 | Actionable daily insight | Daily goal + breakdown visible at a glance |
| O5 | Minimal, delightful UI | Retro terminal aesthetic, all English |

---

## 3. Target User

- Solo developer or knowledge worker
- Uses Google Chrome as primary browser
- Runs app on `localhost:3000` (self-hosted)
- Wants passive tracking without SaaS overhead
- Appreciates retro terminal/hacker aesthetics

---

## 4. Scope

### In Scope
- Chrome Extension (Manifest V3) for heartbeat capture
- Next.js 14 web application (local)
- MySQL database via Docker
- Real-time dashboard via SSE
- Category management, rules engine, ignore list
- History views (day, week, month)
- Error screens for all failure states

### Out of Scope
- Multi-user / authentication
- Cloud hosting / SaaS deployment
- Mobile native apps
- Firefox / Edge extensions
- Integrations (GitHub, Jira, Toggl, etc.)
- Data export (v2 candidate)

---

## 5. Pages & Features

### 5.1 DASHBOARD (`/`)

The primary screen. Refreshes in real time via SSE.

#### Widgets (top row)
| Widget | Description |
|--------|-------------|
| ACTIVE_SESSION | Current category name + elapsed time of ongoing session. No URL shown. Blinks when IDLE. |
| DAILY_GOAL | Progress bar showing tracked time vs. daily goal (hh:mm / goal). Displayed on dashboard only. |
| TOTAL_TRACE | Cumulative tracked time for today (excludes IDLE). |
| SESSION_COUNT | Number of distinct sessions started today. |
| DOMINANT_CATEGORY | Category with most time today, with color badge. |
| IDLE_TIME | Total idle time accumulated today. |

#### Widgets (bottom row)
| Widget | Description |
|--------|-------------|
| DAILY_BREAKDOWN | Compact category breakdown (bar chart or donut). Clickable → `/breakdown`. |
| ACTIVITY_TIMELINE | Compressed 24h color-coded timeline strip. Clickable → `/timeline`. |

#### Behavior
- SSE connection opens on page load at `/api/sse`
- All widgets update without page reload
- If extension is inactive > 120s, show `EXTENSION_INACTIVE` banner
- If SSE drops, show `SERVER_CONNECTION_LOST` banner

---

### 5.2 DAILY_BREAKDOWN (`/breakdown`)

Full-page category breakdown for the current day.

- Horizontal bar chart per category (time + percentage)
- Sorted by duration descending
- Color-coded per category palette
- Shows total tracked time at top
- Date selector (← prev day / today / → future disabled)
- Clicking a category row expands session list for that category (chronological)

---

### 5.3 ACTIVITY_TIMELINE (`/timeline`)

Full 24h color-coded timeline for the current day.

- Horizontal timeline from 00:00 to 23:59
- Each 30s heartbeat block colored by category
- IDLE blocks shown in muted gray
- Untracked blocks (before extension start, gaps) shown in black/void
- Tooltip on hover: category, start time, duration
- Date selector (← prev day / today)
- Zoom controls: 1h / 6h / 24h view

---

### 5.4 HISTORY (`/history`)

Historical view with DAY / WEEK / MONTH toggle.

#### DAY View
- Session list in **chronological order**
- Each session: start time, end time, duration, category badge
- Total tracked time at top

#### WEEK View
- **Individual days visible** (Mon–Sun columns)
- Each day shows category bars proportional to duration
- Click a day → navigates to DAY view for that date
- Weekly totals row at bottom

#### MONTH View
- Heatmap grid (GitHub-style) colored by total tracked time
- Color intensity = more time tracked
- Click a cell → navigates to DAY view for that date
- Monthly total + most productive day callout

---

### 5.5 SETTINGS (`/settings`)

User configuration panel. Changes take effect immediately (no save button — auto-save with debounce 500ms).

#### Categories
- Default categories: CODING, BROWSING, COMM, MEDIA, OTHER, IDLE
- Add custom category: name + color (from preset palette)
- Edit category name or color
- Delete category (sessions reassigned to OTHER)
- Preset palette: 16 colors covering violet, cyan, green, amber, red, pink, etc.
- Drag to reorder categories

#### Categorization Rules
- Each rule: URL pattern → Category
- Pattern syntax: glob-style (`*.github.com`, `localhost:*`, `*notion.so*`)
- Rules evaluated top-to-bottom; first match wins
- Add / edit / delete / reorder rules via drag
- Test field: enter a URL → preview which category it matches

#### Inactivity Settings
- Inactivity delay: slider 1–30 minutes (default: 5 min)
- After delay, current session marked IDLE

#### Ignore List
- Pattern-based URL ignore list (glob-style, same as rules)
- Matching URLs: heartbeats received but not stored
- Example: `*.youtube.com`, `localhost:3000` (self-exclusion)

#### Daily Goal
- Input: hh:mm format
- Default: 08:00
- Used in DAILY_GOAL widget on dashboard

---

### 5.6 ERROR SCREENS

| Screen | Trigger | Message |
|--------|---------|---------|
| 404 | Unknown route | `ERROR_404 // ROUTE NOT FOUND` |
| EXTENSION_INACTIVE | No heartbeat for > 2 min | `SYS.WARN // EXTENSION OFFLINE` + reconnect instructions |
| DB_UNREACHABLE | Prisma connection fails | `SYS.ERR // DATABASE UNREACHABLE` + retry button |
| SERVER_CONNECTION_LOST | SSE drops / API timeout | `SYS.ERR // CONNECTION LOST` + auto-retry countdown |

All error screens maintain the retro terminal aesthetic. Auto-retry with exponential backoff where applicable.

---

## 6. Chrome Extension

### 6.1 Behavior
- Detects active tab URL and title every 30 seconds
- Sends heartbeat to `POST /api/heartbeat`
- Detects user inactivity (no mouse/keyboard events) and flags heartbeat as potentially idle
- Extension popup shows: connection status, current category, today's total

### 6.2 Popup UI
- Status indicator: CONNECTED / DISCONNECTED
- Current category (color badge)
- Today's total tracked time
- Link to open dashboard

### 6.3 Permissions Required
- `tabs` — read active tab URL and title
- `idle` — detect system idle state
- `storage` — persist API endpoint config
- `alarms` — 30s heartbeat interval

---

## 7. Use Cases

### UC-01: CODING Session Tracked

**Precondition:** User connected, Chrome extension active, MySQL running.

1. User opens `localhost:3000/cursor` (or any IDE web tool) in Chrome
2. Extension alarm fires every 30s, reads active tab URL + title
3. Extension POSTs heartbeat: `{ url, title, timestamp, idleSeconds }`
4. API receives heartbeat, checks ignore list → not ignored
5. API evaluates categorization rules → matches `localhost:*` → category: `CODING`
6. Prisma creates/extends session record in MySQL
7. SSE pushes updated state to dashboard
8. Dashboard widgets update: ACTIVE_SESSION shows `CODING · 00:30`, TOTAL_TRACE increments

**Postcondition:** CODING session recorded, visible in dashboard and breakdown.

---

### UC-02: BROWSING Session Tracked

**Precondition:** Same as UC-01.

1. User navigates to `https://stackoverflow.com/questions/...`
2. Extension reads URL, sends heartbeat
3. API matches rule `*.stackoverflow.com` → category: `BROWSING`
4. Session created or extended
5. Dashboard updates: ACTIVE_SESSION shows `BROWSING · 00:30`

**Postcondition:** BROWSING session recorded.

---

### UC-03: COMM Session Tracked

1. User opens `https://slack.com` or `https://mail.google.com`
2. Rule matches `*slack.com*` or `*mail.google.com*` → category: `COMM`
3. Session created, dashboard updated

**Postcondition:** COMM session recorded.

---

### UC-04: IDLE Triggered

**Precondition:** User has inactivity delay set to 5 minutes.

1. User stops mouse/keyboard activity
2. Extension detects idle via Chrome `idle` API
3. After 5 minutes, next heartbeat flagged with `idleSeconds >= 300`
4. API closes current active session, opens IDLE session
5. Dashboard: ACTIVE_SESSION shows `IDLE · blinking`, IDLE_TIME increments
6. User resumes activity → next heartbeat not idle → IDLE session closed, new active session opened

**Postcondition:** IDLE time recorded separately, not counted in TOTAL_TRACE.

---

### UC-05: Custom Category

1. User adds category `LEARNING` with color cyan in Settings
2. User adds rule `*.udemy.com` → `LEARNING`
3. User opens udemy.com → heartbeat received
4. API matches new rule → category: `LEARNING`
5. Dashboard shows `LEARNING` with cyan badge

**Postcondition:** Custom category visible across all views.

---

### UC-06: Ignored URL

1. User adds `localhost:3000` to ignore list
2. User views dashboard (on localhost:3000)
3. Extension sends heartbeat with `url: localhost:3000`
4. API checks ignore list → matches → heartbeat discarded silently
5. No session created, no ACTIVE_SESSION change

**Postcondition:** Self-tracking avoided, no ghost sessions.

---

### UC-07: Extension Inactive

1. User closes Chrome or disables extension
2. No heartbeat received for > 2 minutes
3. Dashboard SSE detects stale state
4. Banner displayed: `SYS.WARN // EXTENSION OFFLINE`
5. User re-enables extension → next heartbeat received → banner dismissed

**Postcondition:** User clearly informed of tracking gap.

---

### UC-08: Database Unreachable

1. Docker MySQL container stops
2. API receives heartbeat → Prisma throws connection error
3. API returns `503`
4. SSE pushes `DB_UNREACHABLE` event
5. Dashboard shows `SYS.ERR // DATABASE UNREACHABLE` with retry button
6. User restarts Docker → API reconnects → retry succeeds → normal state restored

**Postcondition:** User informed, no silent data loss.

---

### UC-09: Server Connection Lost

1. Next.js dev server crashes or network drops
2. SSE connection drops
3. Client detects `EventSource` error
4. `SERVER_CONNECTION_LOST` banner shown with countdown: "RECONNECTING IN 5s..."
5. Client auto-retries with exponential backoff (5s, 10s, 20s, max 60s)
6. Server recovers → SSE reconnects → banner dismissed

**Postcondition:** Graceful degradation, auto-recovery.

---

## 8. Non-Functional Requirements

### 8.1 Performance
- Dashboard SSE latency: ≤ 5 seconds end-to-end from heartbeat to UI update
- API heartbeat endpoint: p95 response time ≤ 200ms
- Page load (dashboard): ≤ 2 seconds on localhost
- History queries: ≤ 500ms for 30-day range

### 8.2 Reliability
- Heartbeat must be idempotent (duplicate 30s heartbeat = no duplicate session)
- Extension must retry failed heartbeats up to 3 times with 5s delay
- SSE client auto-reconnects with exponential backoff

### 8.3 Security
- No authentication (single-user, localhost-only)
- All API routes validate input with Zod
- No sensitive data logged (URLs truncated in logs > 200 chars)
- Extension only connects to configured API endpoint (no hardcoded prod URL)

### 8.4 Accessibility
- Keyboard-navigable settings forms
- Color badges always include text label (not color-only)
- ARIA labels on all interactive widgets
- Terminal aesthetic does not sacrifice contrast (WCAG AA minimum)

### 8.5 Maintainability
- TypeScript strict mode throughout
- 80%+ test coverage (Jest + Testing Library)
- Conventional Commits enforced
- All logic defined in ARCHITECTURE.md before implementation

---

## 9. Success Metrics

| Metric | Target |
|--------|--------|
| Heartbeat capture rate | ≥ 99% of active minutes captured |
| Auto-categorization accuracy | ≥ 90% correct category |
| Dashboard real-time lag | ≤ 5 seconds |
| Zero manual entries required | 100% passive capture |
| Error recovery | All error states auto-recover or show clear CTA |

---

## 10. Design Constraints

- **Language:** All UI text in English (retro authenticity)
- **Font:** Pixel/monospace font (e.g. `VT323`, `Share Tech Mono`, `IBM Plex Mono`)
- **Colors:** Dark background (`#0a0a0f`), violet (`#7c3aed`), cyan (`#06b6d4`), green (`#22c55e`), amber (`#f59e0b`) for accents
- **No animations heavier than CSS transitions** — keep terminal feel snappy
- **All-caps labels** for widget titles and status indicators
- **Scanline or CRT overlay** optional subtle CSS effect on dashboard
