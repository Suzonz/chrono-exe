/**
 * @file src/types/index.ts
 * @description Shared domain, API, SSE, and history types.
 * Dates travel over the wire as ISO strings, so API-facing types use `string`.
 */

// ─── Domain ─────────────────────────────────────────────────────────

export const CATEGORY_COLORS = [
  "violet",
  "cyan",
  "green",
  "amber",
  "red",
  "pink",
  "orange",
  "teal",
  "indigo",
  "lime",
  "yellow",
  "rose",
  "sky",
  "emerald",
  "fuchsia",
  "slate"
] as const;

export type CategoryColor = (typeof CATEGORY_COLORS)[number];

export const PRODUCTIVITY_LEVELS = ["PRODUCTIVE", "NEUTRAL", "DISTRACTING"] as const;
export type Productivity = (typeof PRODUCTIVITY_LEVELS)[number];

export interface Category {
  id: string;
  name: string;
  color: CategoryColor;
  isDefault: boolean;
  order: number;
  productivity: Productivity;
  dailyLimitSeconds: number | null;
  createdAt: string;
}

export interface Rule {
  id: string;
  pattern: string;
  categoryId: string;
  order: number;
  createdAt: string;
}

export interface Settings {
  id: string;
  dailyGoalSeconds: number;
  inactivityDelaySeconds: number;
  updatedAt: string;
}

export interface IgnorePattern {
  id: string;
  pattern: string;
  createdAt: string;
}

/** Lightweight category reference embedded in stats payloads. */
export interface CategoryRef {
  id: string;
  name: string;
  color: CategoryColor;
  productivity: Productivity;
  dailyLimitSeconds: number | null;
}

/** Time spent on one website (host) over a period. */
export interface SiteStat {
  host: string;
  seconds: number;
  /** Category that took most of the time on this site. */
  category: CategoryRef;
}

/** Active time split by productivity level. */
export interface ProductivityStats {
  productiveSeconds: number;
  neutralSeconds: number;
  distractingSeconds: number;
  /** Share of active time spent on productive categories (0–100), null without data. */
  score: number | null;
}

/** A category that went over its daily limit. */
export interface LimitAlert {
  category: CategoryRef;
  usedSeconds: number;
  limitSeconds: number;
}

// ─── Heartbeat ──────────────────────────────────────────────────────

export interface HeartbeatPayload {
  url: string;
  title: string;
  timestamp: string;
  idleSeconds: number;
}

/** Today at a glance, for the extension badge, popup and limit notifications. */
export interface Pulse {
  todayTrackedSeconds: number;
  /** Time spent today on the site of the current tab. */
  site: { host: string; todaySeconds: number } | null;
  limitAlerts: LimitAlert[];
}

export type HeartbeatResponse = (
  | {
      ignored: false;
      sessionId: string;
      categoryId: string;
      categoryName: string;
      categoryColor: CategoryColor;
      isIdle: boolean;
    }
  | { ignored: true; reason: "IGNORED" | "PAUSED" | "STOPPED" }
) & { trackingState: TrackingState; pulse: Pulse | null };

// ─── Real-time (SSE) ────────────────────────────────────────────────

export type SSEEventType = "DASHBOARD_UPDATE" | "DB_UNREACHABLE" | "SERVER_STOPPED";

export interface SSEEvent<T = unknown> {
  type: SSEEventType;
  data: T;
  timestamp: string;
}

export interface ActiveSessionState {
  sessionId: string;
  categoryId: string;
  categoryName: string;
  categoryColor: CategoryColor;
  startedAt: string;
  /** Seconds elapsed at `generatedAt`. */
  elapsedSeconds: number;
  isIdle: boolean;
  /** Website of the latest heartbeat in this session. */
  host: string | null;
  productivity: Productivity;
}

export type TrackingState = "RUNNING" | "PAUSED" | "STOPPED";
export type TrackingAction = "start" | "pause" | "stop";

export interface TrackingStatus {
  state: TrackingState;
  /** Start of the current running stretch, null while paused or stopped. */
  runStartedAt: string | null;
  /** Stopwatch seconds accumulated before the current stretch. */
  accumulatedSeconds: number;
}

export interface DashboardState {
  tracking: TrackingStatus;
  activeSession: ActiveSessionState | null;
  dailyGoalSeconds: number;
  totalTrackedSeconds: number;
  /** Active time on PRODUCTIVE categories today (the daily goal applies to it). */
  productiveSeconds: number;
  /** Active time spent in other apps today (OUTSIDE_CHROME). */
  outsideSeconds: number;
  idleSeconds: number;
  sessionCount: number;
  dominantCategory: CategoryRef | null;
  lastHeartbeatAt: string | null;
  extensionOnline: boolean;
  inactivityThresholdMs: number;
  generatedAt: string;
}

// ─── Stats ──────────────────────────────────────────────────────────

export interface DaySession {
  id: string;
  category: CategoryRef;
  startedAt: string;
  endedAt: string | null;
  /** Seconds that fall inside the requested day. */
  durationSeconds: number;
  isIdle: boolean;
  isActive: boolean;
  heartbeatCount: number;
  /** Most visited host during the session, if any. */
  host: string | null;
}

export interface CategoryBreakdown {
  category: CategoryRef;
  totalSeconds: number;
  percentage: number;
  sessions: DaySession[];
}

export interface FocusStretch {
  category: CategoryRef;
  startedAt: string;
  endedAt: string | null;
  seconds: number;
}

/** Same figures for the previous period, for trends ("+35 min vs yesterday"). */
export interface PreviousPeriod {
  totalTrackedSeconds: number;
  productivityScore: number | null;
}

export interface DailyBreakdown {
  date: string;
  totalTrackedSeconds: number;
  idleSeconds: number;
  sessionCount: number;
  longestFocus: FocusStretch | null;
  categories: CategoryBreakdown[];
  sites: SiteStat[];
  productivity: ProductivityStats;
  limitAlerts: LimitAlert[];
  previous: PreviousPeriod;
  /** Sites that played sound in background tabs (never counted as active time). */
  backgroundAudio: { host: string; seconds: number }[];
}

export interface DaySlot {
  date: string;
  totalTrackedSeconds: number;
  productivityScore: number | null;
  categories: Omit<CategoryBreakdown, "sessions">[];
}

export interface WeeklyBreakdown {
  weekStart: string;
  /** Sites heard in background tabs (added by the stats route). */
  backgroundAudio?: { host: string; seconds: number }[];
  totalTrackedSeconds: number;
  days: DaySlot[];
  weeklyTotals: Omit<CategoryBreakdown, "sessions">[];
  sites: SiteStat[];
  productivity: ProductivityStats;
  previous: PreviousPeriod;
}

export interface HeatmapDay {
  date: string;
  totalTrackedSeconds: number;
  intensity: 0 | 1 | 2 | 3 | 4;
}

export interface MonthlyHeatmap {
  month: string;
  /** Sites heard in background tabs (added by the stats route). */
  backgroundAudio?: { host: string; seconds: number }[];
  days: HeatmapDay[];
  monthlyTotal: number;
  activeDays: number;
  mostProductiveDate: string | null;
  categories: Omit<CategoryBreakdown, "sessions">[];
  sites: SiteStat[];
  productivity: ProductivityStats;
  previous: PreviousPeriod;
}

export interface TimelineBlock {
  sessionId: string;
  startTime: string;
  endTime: string;
  category: CategoryRef;
  isIdle: boolean;
  isActive: boolean;
  host: string | null;
}

export interface ApiError {
  code: string;
  message: string;
  details?: unknown;
}
