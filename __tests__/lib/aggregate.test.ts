import {
  backgroundAudioTotals,
  buildDailyBreakdown,
  buildMonthlyHeatmap,
  buildWeeklyBreakdown,
  intensityFor,
  pulseOf,
  sessionsForDay,
  type RawSession
} from "@/lib/aggregate";
import { summarizeDay } from "@/lib/summary";
import type { CategoryRef } from "@/types";

const CODING: CategoryRef = { id: "c1", name: "CODING", color: "violet", productivity: "PRODUCTIVE", dailyLimitSeconds: null };
const COMM: CategoryRef = { id: "c2", name: "COMM", color: "green", productivity: "NEUTRAL", dailyLimitSeconds: null };
const MEDIA: CategoryRef = { id: "c4", name: "MEDIA", color: "amber", productivity: "DISTRACTING", dailyLimitSeconds: 1800 };
const IDLE: CategoryRef = { id: "c3", name: "IDLE", color: "slate", productivity: "NEUTRAL", dailyLimitSeconds: null };

let id = 0;
function session(
  category: CategoryRef,
  start: Date,
  minutes: number,
  options: { idle?: boolean; open?: boolean; hosts?: Record<string, number> } = {}
): RawSession {
  id += 1;
  const hostCounts = options.hosts ?? { "github.com": minutes * 2 };
  return {
    id: `s${id}`,
    category,
    startedAt: start,
    endedAt: options.open ? null : new Date(start.getTime() + minutes * 60000),
    durationSeconds: minutes * 60,
    isIdle: options.idle ?? false,
    heartbeatCount: minutes * 2,
    host: Object.keys(hostCounts)[0] ?? null,
    hostCounts
  };
}

const day = (d: number, h: number, m = 0) => new Date(2026, 10, d, h, m);

describe("buildDailyBreakdown", () => {
  const sessions = [
    session(CODING, day(15, 9), 30), // yesterday
    session(CODING, day(16, 9), 60, { hosts: { "github.com": 90, "stackoverflow.com": 30 } }),
    session(COMM, day(16, 10), 30, { hosts: { "app.slack.com": 60 } }),
    session(IDLE, day(16, 10, 30), 15, { idle: true }),
    session(MEDIA, day(16, 11), 40, { hosts: { "youtube.com": 80 } })
  ];
  const breakdown = buildDailyBreakdown(sessions, "2026-11-16");

  it("excludes away time from active time", () => {
    expect(breakdown.totalTrackedSeconds).toBe(130 * 60);
    expect(breakdown.idleSeconds).toBe(15 * 60);
    expect(breakdown.sessionCount).toBe(3);
  });

  it("groups by category, sorted by duration", () => {
    expect(breakdown.categories.map((group) => group.category.name)).toEqual(["CODING", "MEDIA", "COMM"]);
    expect(breakdown.longestFocus?.seconds).toBe(3600);
  });

  it("splits a session's time between its sites", () => {
    const sites = Object.fromEntries(breakdown.sites.map((site) => [site.host, site.seconds]));
    expect(sites["github.com"]).toBe(45 * 60);
    expect(sites["stackoverflow.com"]).toBe(15 * 60);
    expect(sites["youtube.com"]).toBe(40 * 60);
    expect(breakdown.sites[0].host).toBe("github.com");
  });

  it("scores productivity as the productive share of active time", () => {
    expect(breakdown.productivity.productiveSeconds).toBe(3600);
    expect(breakdown.productivity.distractingSeconds).toBe(2400);
    expect(breakdown.productivity.score).toBe(Math.round((60 / 130) * 100));
  });

  it("flags categories over their daily limit", () => {
    expect(breakdown.limitAlerts).toEqual([{ category: MEDIA, usedSeconds: 2400, limitSeconds: 1800 }]);
  });

  it("compares with the previous day", () => {
    expect(breakdown.previous).toEqual({ totalTrackedSeconds: 1800, productivityScore: 100 });
  });

  it("summarizes the day in plain English", () => {
    expect(summarizeDay(breakdown, true)).toContain("mostly CODING");
    expect(summarizeDay(breakdown, true)).toContain("Top site: github.com.");
  });
});

describe("sessions crossing midnight", () => {
  it("splits the duration between both days", () => {
    const sessions = [session(CODING, day(16, 23, 30), 60)];
    expect(sessionsForDay(sessions, "2026-11-16")[0].durationSeconds).toBe(1800);
    expect(sessionsForDay(sessions, "2026-11-17")[0].durationSeconds).toBe(1800);
  });
});

describe("buildWeeklyBreakdown", () => {
  it("returns seven days from Monday, totals, sites and last week", () => {
    const week = buildWeeklyBreakdown(
      [session(CODING, day(9, 9), 120), session(CODING, day(16, 9), 60), session(COMM, day(18, 9), 30, { hosts: { "app.slack.com": 60 } })],
      "2026-11-16"
    );
    expect(week.days.map((d) => d.date)).toEqual(["2026-11-16", "2026-11-17", "2026-11-18", "2026-11-19", "2026-11-20", "2026-11-21", "2026-11-22"]);
    expect(week.days[0].totalTrackedSeconds).toBe(3600);
    expect(week.days[0].productivityScore).toBe(100);
    expect(week.totalTrackedSeconds).toBe(5400);
    expect(week.sites.map((site) => site.host)).toEqual(["github.com", "app.slack.com"]);
    expect(week.previous.totalTrackedSeconds).toBe(7200);
  });
});

describe("buildMonthlyHeatmap", () => {
  it("covers every day of the month and finds the best one", () => {
    const month = buildMonthlyHeatmap([session(CODING, day(3, 9), 240), session(CODING, day(10, 9), 60)], "2026-11-20");
    expect(month.days).toHaveLength(30);
    expect(month.mostProductiveDate).toBe("2026-11-03");
    expect(month.activeDays).toBe(2);
    expect(month.monthlyTotal).toBe(300 * 60);
    expect(month.days[2].intensity).toBe(4);
    expect(month.days[9].intensity).toBe(1);
    expect(month.categories[0].category.name).toBe("CODING");
  });

  it("maps totals to 0-4 intensity", () => {
    expect(intensityFor(0, 100)).toBe(0);
    expect(intensityFor(1, 100)).toBe(1);
    expect(intensityFor(100, 100)).toBe(4);
  });
});

describe("pulseOf", () => {
  it("reports today's total, the current site and limit alerts", () => {
    const pulse = pulseOf(
      [session(MEDIA, day(16, 20), 45, { hosts: { "youtube.com": 90 } }), session(CODING, day(16, 9), 30)],
      "2026-11-16",
      "youtube.com"
    );
    expect(pulse.todayTrackedSeconds).toBe(75 * 60);
    expect(pulse.site).toEqual({ host: "youtube.com", todaySeconds: 45 * 60 });
    expect(pulse.limitAlerts).toHaveLength(1);
  });
});

describe("backgroundAudioTotals", () => {
  it("credits each heartbeat until the next one, capped at 30s", () => {
    const t = (s: number) => new Date(2026, 10, 16, 9, 0, s);
    const totals = backgroundAudioTotals([
      { timestamp: t(0), backgroundAudio: "open.spotify.com" },
      { timestamp: t(10), backgroundAudio: "open.spotify.com,youtube.com" },
      { timestamp: t(50), backgroundAudio: null }
    ]);
    expect(totals).toEqual([
      { host: "open.spotify.com", seconds: 40 },
      { host: "youtube.com", seconds: 30 }
    ]);
  });
});
