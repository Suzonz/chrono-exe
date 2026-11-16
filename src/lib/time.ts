/**
 * @file src/lib/time.ts
 * @description Calendar and duration helpers. Pure and shared by client and server.
 *
 * Day keys (`YYYY-MM-DD`) are always interpreted in the local timezone of the
 * runtime. CHRONO.EXE is self-hosted, so the server and the browser share the
 * same timezone and "today" means the same thing on both sides.
 */

export const DATE_KEY_REGEX = /^\d{4}-\d{2}-\d{2}$/;

function pad(value: number, size = 2): string {
  return String(value).padStart(size, "0");
}

export function toDateKey(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function todayKey(): string {
  return toDateKey(new Date());
}

export function parseDateKey(key: string): Date {
  const [year, month, day] = key.split("-").map(Number);
  return new Date(year, month - 1, day, 0, 0, 0, 0);
}

export function addDays(key: string, amount: number): string {
  const date = parseDateKey(key);
  date.setDate(date.getDate() + amount);
  return toDateKey(date);
}

export function addMonths(key: string, amount: number): string {
  const date = parseDateKey(key);
  date.setDate(1);
  date.setMonth(date.getMonth() + amount);
  return toDateKey(date);
}

/** Half-open local range [start, end) covering the given day. */
export function dayRange(key: string): { start: Date; end: Date } {
  const start = parseDateKey(key);
  const end = parseDateKey(addDays(key, 1));
  return { start, end };
}

/** Monday of the ISO week containing `key`. */
export function startOfWeekKey(key: string): string {
  const date = parseDateKey(key);
  const offset = (date.getDay() + 6) % 7;
  return addDays(key, -offset);
}

export function startOfMonthKey(key: string): string {
  return `${key.slice(0, 7)}-01`;
}

export function daysInMonth(key: string): number {
  const date = parseDateKey(startOfMonthKey(key));
  return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
}

/** Seconds of [start, end) that overlap [rangeStart, rangeEnd). */
export function overlapSeconds(start: Date, end: Date, rangeStart: Date, rangeEnd: Date): number {
  const from = Math.max(start.getTime(), rangeStart.getTime());
  const to = Math.min(end.getTime(), rangeEnd.getTime());
  return Math.max(0, Math.floor((to - from) / 1000));
}

/** `HH:MM:SS` (hours can exceed 24). */
export function formatDuration(totalSeconds: number): string {
  const total = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return `${pad(h)}:${pad(m)}:${pad(s)}`;
}

/** Compact `2H 05M` / `14M` / `45S` form. */
export function formatCompact(totalSeconds: number): string {
  const total = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  if (h > 0) return `${h}H ${pad(m)}M`;
  if (m > 0) return `${m}M`;
  return `${total}S`;
}

/** `HH:MM` clock time in local timezone. */
export function formatClock(value: Date | string, withSeconds = false): string {
  const date = typeof value === "string" ? new Date(value) : value;
  const base = `${pad(date.getHours())}:${pad(date.getMinutes())}`;
  return withSeconds ? `${base}:${pad(date.getSeconds())}` : base;
}

const WEEKDAYS = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"] as const;
const WEEKDAYS_LONG = ["SUNDAY", "MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY"] as const;
const MONTHS = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"] as const;
const MONTHS_LONG = [
  "JANUARY",
  "FEBRUARY",
  "MARCH",
  "APRIL",
  "MAY",
  "JUNE",
  "JULY",
  "AUGUST",
  "SEPTEMBER",
  "OCTOBER",
  "NOVEMBER",
  "DECEMBER"
] as const;

/** `MON 16 NOV 2026` */
export function formatDayLabel(key: string): string {
  const date = parseDateKey(key);
  return `${WEEKDAYS[date.getDay()]} ${pad(date.getDate())} ${MONTHS[date.getMonth()]} ${date.getFullYear()}`;
}

/** `MONDAY 16 NOVEMBER 2026` */
export function formatLongDay(date: Date): string {
  return `${WEEKDAYS_LONG[date.getDay()]} ${date.getDate()} ${MONTHS_LONG[date.getMonth()]} ${date.getFullYear()}`;
}

/** `NOVEMBER 2026` */
export function formatMonthLabel(key: string): string {
  const date = parseDateKey(key);
  return `${MONTHS_LONG[date.getMonth()]} ${date.getFullYear()}`;
}

/** `16 NOV - 22 NOV 2026` */
export function formatWeekLabel(weekStartKey: string): string {
  const start = parseDateKey(weekStartKey);
  const end = parseDateKey(addDays(weekStartKey, 6));
  return `${pad(start.getDate())} ${MONTHS[start.getMonth()]} - ${pad(end.getDate())} ${MONTHS[end.getMonth()]} ${end.getFullYear()}`;
}

export function weekdayShort(key: string): string {
  return WEEKDAYS[parseDateKey(key).getDay()];
}

/** Parses `HH:MM` into seconds, or null when invalid. */
export function parseHoursMinutes(value: string): number | null {
  const match = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) return null;
  return hours * 3600 + minutes * 60;
}

export function toHoursMinutes(totalSeconds: number): string {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  return `${pad(h)}:${pad(m)}`;
}
