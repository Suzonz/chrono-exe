# CHRONO.EXE — Architecture Document (Agent-Ready)

**Version:** 2.0.0
**Status:** Production-ready for AI generation
**Last Updated:** 2026-05-06

---

# 0. Bootstrap Rules (MANDATORY)

The project may start from an almost empty folder.

The agent MUST assume that NOTHING exists except:

* `/docs`
* `.cursorrules`
* `.env*`
* `docker-compose.yml`
* `prisma/schema.prisma`

### Required behavior

If any file is missing, the agent MUST create it:

* package.json
* tsconfig.json
* next.config.ts
* tailwind.config.ts
* postcss.config.js
* src/ directory

Rules:

1. NEVER assume a file exists
2. ALWAYS check before writing
3. If exists → extend safely
4. If missing → create

The rules file is named exactly:

```
.cursorrules
```

---

# 1. Tech Stack (Source of Truth)

These versions MUST be used.

| Technology       | Version     |
| ---------------- | ----------- |
| Next.js          | 14.2.x      |
| TypeScript       | 5.4.x       |
| Tailwind CSS     | 3.4.x       |
| Prisma           | 5.14.x      |
| MySQL            | 8.0         |
| Jest             | 29.x        |
| Testing Library  | 14.x        |
| Chrome Extension | Manifest V3 |
| Zod              | 3.23.x      |

---

# 2. Execution Order (STRICT)

The agent MUST follow this exact order:

1. Initialize Next.js project
2. Setup config (TypeScript, Tailwind)
3. Setup Prisma & database
4. Create core backend (lib/)
5. Implement API routes
6. Implement SSE system
7. Build frontend (pages + hooks + components)
8. Build Chrome extension
9. Add tests

DO NOT skip phases.
DO NOT jump ahead.

---

# 3. Project Initialization

If no Next.js project exists:

Run:

```
npx create-next-app@latest . --typescript --app --tailwind --eslint --src-dir --import-alias "@/*"
```

Then adjust to match this architecture.

---

# 4. package.json (MANDATORY)

```json
{
  "name": "chrono-exe",
  "version": "1.0.0",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "next lint",
    "test": "jest",
    "prisma:migrate": "prisma migrate dev",
    "prisma:generate": "prisma generate",
    "db:seed": "ts-node prisma/seed.ts",
    "build:extension": "tsc -p extension/tsconfig.json"
  }
}
```

---

# 5. Folder Structure (Simplified)

Key directories:

* `src/app` → pages & API
* `src/components` → UI
* `src/lib` → backend logic
* `src/hooks` → frontend logic
* `prisma` → database
* `extension` → Chrome extension

The agent MUST create folders progressively when needed.

---

# 6. Database Setup (Prisma)

Use existing `prisma/schema.prisma`.

### Steps

1. Install Prisma
2. Run:

```
npx prisma generate
npx prisma migrate dev --name init
```

---

# 7. Core Backend (lib/)

Create in this order:

### Phase 4.1

* glob.ts
* ignoreList.ts
* categorizer.ts

### Phase 4.2

* sessionManager.ts

### Phase 4.3

* sse.ts

### Rules

* Use Prisma for all DB access
* Use in-memory caching where specified
* NEVER leave TODOs

---

# 8. API Routes

Create under:

```
src/app/api/
```

### Order

1. /heartbeat
2. /categories
3. /rules
4. /settings
5. /stats
6. /sessions
7. /timeline
8. /ignore-patterns

### Rules

* Validate with Zod
* Return typed responses
* Handle errors explicitly

---

# 9. Real-Time Layer (SSE)

Implement after API is stable.

### Requirements

* Route: `/api/sse`
* Use EventSource
* Broadcast events from backend
* Add inactivity monitor

---

# 10. Frontend

Build AFTER backend is functional.

### Order

1. Hooks
2. UI components
3. Pages

### Pages

* `/` (dashboard)
* `/breakdown`
* `/timeline`
* `/history`
* `/settings`

---

# 11. Chrome Extension

Create `/extension`

### Required files

* manifest.json
* background.ts
* popup/

### Behavior

* Send heartbeat every 30s
* Detect idle state
* POST to `/api/heartbeat`

---

# 12. Testing

Create `__tests__/`

### Coverage

* API routes
* lib functions
* key components

Use:

* Jest
* Testing Library

---

# 13. Environment Variables

```
DATABASE_URL="mysql://chrono:chrono@localhost:3306/chronoexe"
NEXT_PUBLIC_API_URL="http://localhost:3000"
SSE_INACTIVITY_THRESHOLD_MS=120000
```

---

# 14. Docker

Use existing docker-compose.yml

Run:

```
docker-compose up -d
```

---

# 15. Defensive Rules

* If import fails → create file
* If type missing → define in `src/types`
* If Prisma fails → regenerate client
* If dependency missing → install it
* NEVER leave incomplete code
* ALWAYS produce runnable code

---

# 16. Expected State Checkpoints

### After Phase 3

* Next.js runs
* DB connected
* Prisma works

### After Phase 6

* Heartbeat works
* SSE emits events

### After Phase 10

* UI fully functional

If a checkpoint fails → FIX before continuing.

---

# 17. Architecture Principles (Aligned with .cursorrules)

* Strict TypeScript (no any)
* Clean separation (UI / logic / data)
* No duplicated logic
* Server is source of truth
* Extension is dumb client

---

## 18. Shared Types (`src/types/index.ts`)

```typescript
// ─── Domain Entities ───────────────────────────────────────────────

export interface Category {
  id: string;
  name: string;           // e.g. "CODING"
  color: CategoryColor;   // preset palette value
  isDefault: boolean;     // cannot be deleted
  order: number;          // drag-to-reorder index
  createdAt: Date;
}

export type CategoryColor =
  | 'violet' | 'cyan' | 'green' | 'amber' | 'red'
  | 'pink' | 'orange' | 'teal' | 'indigo' | 'lime'
  | 'yellow' | 'rose' | 'sky' | 'emerald' | 'fuchsia' | 'slate';

export interface Rule {
  id: string;
  pattern: string;        // glob pattern, e.g. "*.github.com"
  categoryId: string;
  order: number;          // evaluation order, first match wins
  createdAt: Date;
}

export interface Session {
  id: string;
  categoryId: string;
  category?: Category;
  startedAt: Date;
  endedAt: Date | null;   // null = active session
  durationSeconds: number;
  isIdle: boolean;
  heartbeatCount: number;
}

export interface Heartbeat {
  id: string;
  url: string;
  title: string;
  categoryId: string;
  sessionId: string;
  isIdle: boolean;
  idleSeconds: number;
  timestamp: Date;
}

export interface Settings {
  id: string;
  dailyGoalSeconds: number;   // default: 28800 (8h)
  inactivityDelaySeconds: number; // default: 300 (5 min)
  updatedAt: Date;
}

export interface IgnorePattern {
  id: string;
  pattern: string;        // glob pattern
  createdAt: Date;
}

// ─── API Payloads ───────────────────────────────────────────────────

export interface HeartbeatPayload {
  url: string;
  title: string;
  timestamp: string;      // ISO 8601
  idleSeconds: number;
}

export interface HeartbeatResponse {
  sessionId: string;
  categoryId: string;
  categoryName: string;
  isIdle: boolean;
}

// ─── SSE Events ────────────────────────────────────────────────────

export type SSEEventType =
  | 'DASHBOARD_UPDATE'
  | 'EXTENSION_INACTIVE'
  | 'DB_UNREACHABLE'
  | 'CONNECTION_LOST';

export interface DashboardState {
  activeSession: ActiveSessionState | null;
  dailyGoalSeconds: number;
  totalTrackedSeconds: number;
  idleSeconds: number;
  sessionCount: number;
  dominantCategory: Category | null;
  lastHeartbeatAt: string | null;   // ISO 8601
}

export interface ActiveSessionState {
  categoryId: string;
  categoryName: string;
  categoryColor: CategoryColor;
  elapsedSeconds: number;
  isIdle: boolean;
}

export interface SSEEvent<T = unknown> {
  type: SSEEventType;
  data: T;
  timestamp: string;
}

// ─── Stats & History ────────────────────────────────────────────────

export interface DailyBreakdown {
  date: string;           // YYYY-MM-DD
  totalTrackedSeconds: number;
  categories: CategoryBreakdown[];
}

export interface CategoryBreakdown {
  category: Category;
  totalSeconds: number;
  percentage: number;
  sessions: Session[];
}

export interface WeeklyBreakdown {
  weekStart: string;      // YYYY-MM-DD (Monday)
  days: DaySlot[];
  weeklyTotals: CategoryBreakdown[];
}

export interface DaySlot {
  date: string;
  totalTrackedSeconds: number;
  categories: CategoryBreakdown[];
}

export interface MonthlyHeatmap {
  month: string;          // YYYY-MM
  days: HeatmapDay[];
  monthlyTotal: number;
  mostProductiveDate: string | null;
}

export interface HeatmapDay {
  date: string;
  totalTrackedSeconds: number;
  intensity: 0 | 1 | 2 | 3 | 4;  // 0=none, 4=max
}

export interface TimelineBlock {
  startTime: Date;
  endTime: Date;
  categoryId: string | null;
  categoryColor: CategoryColor | null;
  isIdle: boolean;
  isUntracked: boolean;
}

// ─── API Error ──────────────────────────────────────────────────────

export interface ApiError {
  code: string;
  message: string;
  details?: unknown;
}
```

---

## 19. Prisma Schema (`prisma/schema.prisma`)

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "mysql"
  url      = env("DATABASE_URL")
}

model Category {
  id        String    @id @default(cuid())
  name      String    @unique @db.VarChar(64)
  color     String    @db.VarChar(32)
  isDefault Boolean   @default(false)
  order     Int       @default(0)
  createdAt DateTime  @default(now())
  updatedAt DateTime  @updatedAt

  rules     Rule[]
  sessions  Session[]
  heartbeats Heartbeat[]

  @@index([order])
}

model Rule {
  id         String   @id @default(cuid())
  pattern    String   @db.VarChar(256)
  categoryId String
  order      Int      @default(0)
  createdAt  DateTime @default(now())
  updatedAt  DateTime @updatedAt

  category   Category @relation(fields: [categoryId], references: [id], onDelete: Cascade)

  @@index([order])
  @@index([categoryId])
}

model Session {
  id              String     @id @default(cuid())
  categoryId      String
  startedAt       DateTime
  endedAt         DateTime?
  durationSeconds Int        @default(0)
  isIdle          Boolean    @default(false)
  heartbeatCount  Int        @default(0)
  createdAt       DateTime   @default(now())
  updatedAt       DateTime   @updatedAt

  category   Category    @relation(fields: [categoryId], references: [id])
  heartbeats Heartbeat[]

  @@index([startedAt])
  @@index([categoryId])
  @@index([isIdle])
}

model Heartbeat {
  id            String   @id @default(cuid())
  url           String   @db.VarChar(512)
  title         String   @db.VarChar(256)
  categoryId    String
  sessionId     String
  isIdle        Boolean  @default(false)
  idleSeconds   Int      @default(0)
  timestamp     DateTime
  createdAt     DateTime @default(now())

  category  Category @relation(fields: [categoryId], references: [id])
  session   Session  @relation(fields: [sessionId], references: [id])

  @@index([timestamp])
  @@index([sessionId])
  @@unique([sessionId, timestamp])
}

model Settings {
  id                     String   @id @default(cuid())
  dailyGoalSeconds       Int      @default(28800)
  inactivityDelaySeconds Int      @default(300)
  updatedAt              DateTime @updatedAt
}

model IgnorePattern {
  id        String   @id @default(cuid())
  pattern   String   @unique @db.VarChar(256)
  createdAt DateTime @default(now())
}
```

---

## 20. API Routes (Detailed)

### `POST /api/heartbeat`

**Description:** Receives a heartbeat from the Chrome extension.

**Request Body (Zod schema):**
```typescript
z.object({
  url: z.string().url().max(512),
  title: z.string().max(256),
  timestamp: z.string().datetime(),
  idleSeconds: z.number().int().min(0),
})
```

**Logic:**
1. Validate body with Zod
2. Check ignore list — if URL matches any pattern, return `204 No Content`
3. Determine if idle: `idleSeconds >= settings.inactivityDelaySeconds`
4. Run categorizer: URL → category (fallback: `OTHER`)
5. Call `sessionManager.processHeartbeat()`
6. Broadcast `DASHBOARD_UPDATE` via SSE broadcaster
7. Return `200` with `HeartbeatResponse`

**Error responses:**
- `400` — Invalid payload (Zod error)
- `503` — Database unreachable

---

### `GET /api/sse`

**Description:** Server-Sent Events stream for real-time dashboard updates.

**Headers:** `Content-Type: text/event-stream`, `Cache-Control: no-cache`

**Events emitted:**
- `DASHBOARD_UPDATE` — on every heartbeat processed
- `EXTENSION_INACTIVE` — when no heartbeat received for > 2 minutes (checked every 30s server-side)
- `DB_UNREACHABLE` — when Prisma throws connection error

**Behavior:** Connection kept alive with 30s keepalive comment. On client disconnect, stream closed and cleaned up.

---

### `GET /api/stats`

**Query params:**
```
?period=day|week|month&date=YYYY-MM-DD
```

**Returns:**
- `period=day` → `DailyBreakdown`
- `period=week` → `WeeklyBreakdown`
- `period=month` → `MonthlyHeatmap`

---

### `GET /api/sessions`

**Query params:**
```
?date=YYYY-MM-DD&categoryId=<id>
```
Returns `Session[]` for given day, optionally filtered by category.

---

### `GET /api/timeline`

**Query params:**
```
?date=YYYY-MM-DD
```
Returns `TimelineBlock[]` for the given day (all 24h, including untracked gaps).

---

### `GET|POST|PUT|DELETE /api/categories`

| Method | Path | Body | Returns |
|--------|------|------|---------|
| GET | `/api/categories` | — | `Category[]` |
| POST | `/api/categories` | `{ name, color }` | `Category` |
| PUT | `/api/categories/:id` | `{ name?, color?, order? }` | `Category` |
| DELETE | `/api/categories/:id` | — | `204` |

DELETE reassigns sessions/heartbeats of deleted category to `OTHER`.

---

### `GET|POST|PUT|DELETE /api/rules`

| Method | Path | Body | Returns |
|--------|------|------|---------|
| GET | `/api/rules` | — | `Rule[]` |
| POST | `/api/rules` | `{ pattern, categoryId, order }` | `Rule` |
| PUT | `/api/rules/:id` | `{ pattern?, categoryId?, order? }` | `Rule` |
| DELETE | `/api/rules/:id` | — | `204` |

---

### `GET|PUT /api/settings`

| Method | Body | Returns |
|--------|------|---------|
| GET | — | `Settings` |
| PUT | `{ dailyGoalSeconds?, inactivityDelaySeconds? }` | `Settings` |

---

### `GET|POST|DELETE /api/ignore-patterns`

| Method | Body | Returns |
|--------|------|---------|
| GET | — | `IgnorePattern[]` |
| POST | `{ pattern }` | `IgnorePattern` |
| DELETE | `:id` | `204` |

---

## 21. Core Library Functions

### `src/lib/glob.ts`

```typescript
/**
 * Converts a glob pattern to a RegExp.
 * Supports: * (any chars except .), ** (any chars including .), ? (single char)
 */
export function globToRegExp(pattern: string): RegExp

/**
 * Tests a URL string against a glob pattern.
 */
export function matchesGlob(url: string, pattern: string): boolean
```

---

### `src/lib/ignoreList.ts`

```typescript
/**
 * Checks if a URL matches any pattern in the ignore list.
 * Fetches patterns from DB (cached in-memory, invalidated on settings change).
 */
export async function isIgnored(url: string): Promise<boolean>

/**
 * Invalidates the in-memory ignore list cache.
 * Called after any PUT/POST/DELETE to /api/ignore-patterns.
 */
export function invalidateIgnoreCache(): void
```

---

### `src/lib/categorizer.ts`

```typescript
/**
 * Evaluates URL against all rules (ordered by Rule.order ASC).
 * Returns the first matching Category, or the default 'OTHER' category.
 * Rules are cached in-memory, invalidated on rules change.
 */
export async function categorize(url: string): Promise<Category>

/**
 * Invalidates the in-memory rules cache.
 * Called after any mutation to /api/rules or /api/categories.
 */
export function invalidateRulesCache(): void
```

---

### `src/lib/sessionManager.ts`

```typescript
interface HeartbeatInput {
  url: string;
  title: string;
  timestamp: Date;
  idleSeconds: number;
  categoryId: string;
  isIdle: boolean;
}

/**
 * Core session state machine.
 * - If no active session: create new session + heartbeat
 * - If active session, same category, not idle: extend session (increment heartbeatCount, update durationSeconds)
 * - If active session, category changed: close current session, open new one
 * - If idle triggered: close active session, open IDLE session
 * - Ensures idempotency via unique constraint on (sessionId, timestamp)
 * Returns the session record and heartbeat record.
 */
export async function processHeartbeat(input: HeartbeatInput): Promise<{
  session: Session;
  heartbeat: Heartbeat;
}>

/**
 * Closes any open session (endedAt = now).
 * Called when extension goes inactive.
 */
export async function closeActiveSession(): Promise<void>

/**
 * Returns the current open session, if any.
 */
export async function getActiveSession(): Promise<Session | null>
```

---

### `src/lib/sse.ts`

```typescript
/**
 * Registers a new SSE client response stream.
 * Returns a cleanup function to call on disconnect.
 */
export function addSSEClient(
  res: Response,
  writer: WritableStreamDefaultWriter
): () => void

/**
 * Broadcasts a typed SSE event to all connected clients.
 */
export function broadcast<T>(event: SSEEvent<T>): void

/**
 * Starts the server-side inactivity monitor.
 * Every 30s, checks lastHeartbeatAt. If > 2 minutes ago, broadcasts EXTENSION_INACTIVE.
 */
export function startInactivityMonitor(): void

/**
 * Updates the last heartbeat timestamp (called by heartbeat route).
 */
export function recordHeartbeat(): void
```

---

### `src/lib/prisma.ts`

```typescript
/**
 * Prisma client singleton — prevents connection pool exhaustion in dev.
 */
const prisma: PrismaClient
export default prisma
```

---

## 22. React Hooks

### `useSSE` (`src/hooks/useSSE.ts`)
```typescript
function useSSE(): {
  dashboardState: DashboardState | null;
  connectionStatus: 'connecting' | 'connected' | 'reconnecting' | 'error';
  errorType: SSEEventType | null;
}
```
Opens `EventSource` on `/api/sse`. Handles reconnect with exponential backoff. Dispatches state from incoming events.

---

### `useDashboard` (`src/hooks/useDashboard.ts`)
```typescript
function useDashboard(): {
  activeSession: ActiveSessionState | null;
  dailyGoalSeconds: number;
  totalTrackedSeconds: number;
  idleSeconds: number;
  sessionCount: number;
  dominantCategory: Category | null;
  isExtensionInactive: boolean;
  connectionStatus: string;
}
```
Consumes `useSSE`. Derives computed values. Manages local elapsed-time ticker (increments `elapsedSeconds` every second client-side between SSE updates).

---

### `useCategories` (`src/hooks/useCategories.ts`)
```typescript
function useCategories(): {
  categories: Category[];
  isLoading: boolean;
  addCategory: (name: string, color: CategoryColor) => Promise<void>;
  updateCategory: (id: string, data: Partial<Category>) => Promise<void>;
  deleteCategory: (id: string) => Promise<void>;
  reorderCategories: (orderedIds: string[]) => Promise<void>;
}
```

---

### `useRules` (`src/hooks/useRules.ts`)
```typescript
function useRules(): {
  rules: Rule[];
  isLoading: boolean;
  addRule: (pattern: string, categoryId: string) => Promise<void>;
  updateRule: (id: string, data: Partial<Rule>) => Promise<void>;
  deleteRule: (id: string) => Promise<void>;
  reorderRules: (orderedIds: string[]) => Promise<void>;
  testPattern: (url: string) => Promise<Category | null>;
}
```

---

### `useSettings` (`src/hooks/useSettings.ts`)
```typescript
function useSettings(): {
  settings: Settings | null;
  isLoading: boolean;
  updateSettings: (data: Partial<Settings>) => Promise<void>;
}
```
Debounced auto-save (500ms) on any change.

---

### `useHistory` (`src/hooks/useHistory.ts`)
```typescript
function useHistory(period: 'day' | 'week' | 'month', date: string): {
  data: DailyBreakdown | WeeklyBreakdown | MonthlyHeatmap | null;
  isLoading: boolean;
  error: string | null;
  goToPrevious: () => void;
  goToNext: () => void;
  isToday: boolean;
}
```

---

### `useBreakdown` (`src/hooks/useBreakdown.ts`)
```typescript
function useBreakdown(date: string): {
  breakdown: DailyBreakdown | null;
  isLoading: boolean;
  expandedCategoryId: string | null;
  setExpandedCategoryId: (id: string | null) => void;
}
```

---

## 23. Component Reference

### UI Primitives (`src/components/ui/`)

| Component | Props | Role |
|-----------|-------|------|
| `TerminalCard` | `title: string, children, className?` | Retro bordered card with scanline header |
| `StatusBanner` | `type: SSEEventType, message: string, onRetry?: () => void` | Full-width error/warning banner |
| `ColorBadge` | `color: CategoryColor, label: string` | Colored pill with text label |
| `ProgressBar` | `value: number, max: number, color?: CategoryColor` | Retro segmented progress bar |
| `DateNavigator` | `date: string, onPrev, onNext, disableNext: boolean` | ← date → navigation control |
| `TabToggle` | `options: string[], value: string, onChange` | DAY/WEEK/MONTH toggle |
| `ErrorScreen` | `code: string, message: string, onRetry?` | Full-page retro error screen |

---

### Dashboard Components (`src/components/dashboard/`)

| Component | Consumes | Role |
|-----------|----------|------|
| `ActiveSession` | `dashboardState.activeSession` | Shows category + elapsed time, blinks on IDLE |
| `DailyGoal` | `totalTrackedSeconds, dailyGoalSeconds` | Progress bar + hh:mm/goal display |
| `TotalTrace` | `totalTrackedSeconds` | Formatted total tracked time |
| `SessionCount` | `sessionCount` | Integer count of today's sessions |
| `DominantCategory` | `dominantCategory` | Category name + color badge |
| `IdleTime` | `idleSeconds` | Formatted idle time |
| `DailyBreakdownWidget` | fetches own data | Compact bar chart, links to /breakdown |
| `ActivityTimelineWidget` | fetches own data | Compressed 24h strip, links to /timeline |

---

## 24. Real-Time Communication Strategy

**Chosen:** Server-Sent Events (SSE)

**Rationale (ADR-001):** SSE is sufficient for unidirectional server→client updates. WebSockets would add complexity (connection management, protocol overhead) with no benefit for this single-user, read-only dashboard pattern. SSE works natively in browsers with `EventSource`, auto-reconnects, and is compatible with Next.js App Router streaming responses.

**Implementation:**

```
Extension ──POST /api/heartbeat──► API Route
                                      │
                                      ├─► sessionManager.processHeartbeat()
                                      ├─► sse.broadcast(DASHBOARD_UPDATE)
                                      └─► sse.recordHeartbeat()

Browser ◄──SSE /api/sse──── SSE Broadcaster ◄──── Inactivity Monitor (30s tick)
```

**SSE format:**
```
event: DASHBOARD_UPDATE\n
data: {"type":"DASHBOARD_UPDATE","data":{...},"timestamp":"..."}\n\n
```

**Client reconnect:** `EventSource` native reconnect + custom exponential backoff (5s → 10s → 20s → max 60s).

---

## 25. Chrome Extension Architecture (`extension/`)

### `manifest.json`
```json
{
  "manifest_version": 3,
  "name": "CHRONO.EXE",
  "version": "1.0.0",
  "permissions": ["tabs", "idle", "storage", "alarms"],
  "background": {
    "service_worker": "background.js"
  },
  "action": {
    "default_popup": "popup/popup.html"
  }
}
```

### `background.ts` (Service Worker)

```typescript
// Alarms API — fires every 30s
chrome.alarms.create('heartbeat', { periodInMinutes: 0.5 });

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name !== 'heartbeat') return;
  await sendHeartbeat();
});

async function sendHeartbeat(): Promise<void>
// 1. Get active tab (chrome.tabs.query)
// 2. Get idle state (chrome.idle.queryState)
// 3. Read API endpoint from chrome.storage.local
// 4. POST to /api/heartbeat with retry (up to 3 attempts, 5s delay)
// 5. Store last response in chrome.storage.local for popup

async function getIdleSeconds(): Promise<number>
// Returns seconds since last user input via chrome.idle API
```

### `popup.ts`
```typescript
// Reads from chrome.storage.local:
// - connectionStatus: 'connected' | 'disconnected'
// - currentCategory: string
// - currentColor: CategoryColor
// - todayTotalSeconds: number
// Renders into popup.html DOM
// "Open Dashboard" button → opens localhost:3000
```

---

## 26. Prisma Migration & Seed Strategy

### Migrations
- All schema changes via `prisma migrate dev` in development
- Migration files committed to version control
- Naming convention: `YYYYMMDD_description` (auto-generated)

### Seed (`prisma/seed.ts`)
Creates:
1. Default settings record (dailyGoalSeconds: 28800, inactivityDelaySeconds: 300)
2. Default categories in order: CODING (violet), BROWSING (cyan), COMM (green), MEDIA (amber), IDLE (slate), OTHER (slate)
3. Default rules:
   - `localhost:*` → CODING
   - `*.github.com` → CODING
   - `*.stackoverflow.com` → BROWSING
   - `*.slack.com` → COMM
   - `*.mail.google.com` → COMM
   - `*.youtube.com` → MEDIA

---

## 27. Architecture Decision Records

### ADR-001: SSE over WebSockets
- **Decision:** Use Server-Sent Events for real-time dashboard updates
- **Rationale:** Communication is server→client only. SSE is simpler, HTTP-native, auto-reconnects, and works with Next.js App Router. No need for bidirectional channel.
- **Tradeoff:** If future features require client→server push (e.g., manual session editing with live sync), WebSocket migration would be needed.

### ADR-002: Server-side categorization
- **Decision:** Categorize URL on API server, not in extension
- **Rationale:** Rules are stored in DB; server is the source of truth. Extension stays thin and dumb. Category changes take effect immediately without extension update.
- **Tradeoff:** 30s lag between rule change and correct categorization (one heartbeat cycle).

### ADR-003: In-memory caching for rules and ignore list
- **Decision:** Cache rules and ignore patterns in server memory, invalidate on mutation
- **Rationale:** Heartbeat route is called every 30s; DB round-trip on every heartbeat is wasteful. Invalidation on mutation keeps data fresh.
- **Tradeoff:** If multiple Next.js instances ran (not applicable for localhost), cache would be inconsistent. Acceptable for single-user local deployment.

### ADR-004: Glob pattern matching for rules and ignore list
- **Decision:** Use glob-style patterns (`*.domain.com`, `localhost:*`) not regex
- **Rationale:** Safer for user-entered data, easier to understand, covers all practical use cases. Regex would be a security risk (ReDoS) with user input.

### ADR-005: Preset color palette only
- **Decision:** Categories use a fixed 16-color preset palette
- **Rationale:** Ensures visual consistency with retro terminal aesthetic. Colors are pre-tuned to work on dark background. No color picker UI complexity.

### ADR-006: No authentication
- **Decision:** No auth layer
- **Rationale:** Single-user, localhost-only application. Adding auth would add complexity with zero security benefit.


---

## 28. Dependency Graph (Key Imports)

```
app/page.tsx
  └── hooks/useDashboard.ts
        └── hooks/useSSE.ts
  └── components/dashboard/*
        └── components/ui/*

app/api/heartbeat/route.ts
  └── lib/ignoreList.ts
        └── lib/glob.ts
        └── lib/prisma.ts
  └── lib/categorizer.ts
        └── lib/glob.ts
        └── lib/prisma.ts
  └── lib/sessionManager.ts
        └── lib/prisma.ts
  └── lib/sse.ts

app/api/sse/route.ts
  └── lib/sse.ts
  └── lib/sessionManager.ts
  └── lib/prisma.ts

extension/background.ts
  (standalone, no shared src imports)
```
