import { closingTimeOf, decideHeartbeat, isSessionStale, type ActiveSessionSnapshot } from "@/lib/sessionLogic";

const THRESHOLD = 120_000;
const t0 = new Date("2026-11-16T09:00:00.000Z");
const at = (seconds: number) => new Date(t0.getTime() + seconds * 1000);

const active = (overrides: Partial<ActiveSessionSnapshot> = {}): ActiveSessionSnapshot => ({
  categoryId: "coding",
  isIdle: false,
  startedAt: t0,
  durationSeconds: 60, // last heartbeat at t0 + 60s
  ...overrides
});

describe("decideHeartbeat", () => {
  it("starts a session when none is open", () => {
    expect(decideHeartbeat(null, { categoryId: "coding", isIdle: false, timestamp: t0 }, THRESHOLD)).toEqual({ kind: "start" });
  });

  it("extends the session for the same category", () => {
    const decision = decideHeartbeat(active(), { categoryId: "coding", isIdle: false, timestamp: at(90) }, THRESHOLD);
    expect(decision).toEqual({ kind: "extend", durationSeconds: 90 });
  });

  it("switches when the category changes, closing at the new heartbeat", () => {
    const decision = decideHeartbeat(active(), { categoryId: "comm", isIdle: false, timestamp: at(90) }, THRESHOLD);
    expect(decision).toEqual({ kind: "switch", endedAt: at(90), durationSeconds: 90 });
  });

  it("switches when the user goes idle on the same page", () => {
    const decision = decideHeartbeat(active(), { categoryId: "coding", isIdle: true, timestamp: at(90) }, THRESHOLD);
    expect(decision.kind).toBe("switch");
  });

  it("closes the session where it really ended after a tracking gap", () => {
    // Laptop asleep for an hour: the session must not absorb the hour.
    const decision = decideHeartbeat(active(), { categoryId: "coding", isIdle: false, timestamp: at(3600) }, THRESHOLD);
    expect(decision).toEqual({ kind: "gap", endedAt: at(90), durationSeconds: 90 });
  });

  it("ignores heartbeats older than the last one (late retries)", () => {
    const decision = decideHeartbeat(active(), { categoryId: "comm", isIdle: false, timestamp: at(30) }, THRESHOLD);
    expect(decision).toEqual({ kind: "stale" });
  });
});

describe("staleness", () => {
  it("detects a silent extension", () => {
    expect(isSessionStale(active(), at(60 + 119), THRESHOLD)).toBe(false);
    expect(isSessionStale(active(), at(60 + 121), THRESHOLD)).toBe(true);
    expect(closingTimeOf(active())).toEqual(at(90));
  });
});
