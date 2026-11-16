import { applyScope } from "@/lib/scope";
import type { RawSession } from "@/lib/aggregate";
import type { CategoryRef } from "@/types";

const ref = (name: string): CategoryRef => ({ id: name, name, color: "teal", productivity: "NEUTRAL", dailyLimitSeconds: null });
const session = (name: string): RawSession => ({
  id: name,
  category: ref(name),
  startedAt: new Date(2026, 10, 16, 9),
  endedAt: new Date(2026, 10, 16, 10),
  durationSeconds: 3600,
  isIdle: false,
  heartbeatCount: 120,
  host: null,
  hostCounts: {}
});

describe("applyScope", () => {
  const sessions = [session("CODING"), session("OUTSIDE_CHROME"), session("MEDIA")];

  it("keeps everything for the whole computer", () => {
    expect(applyScope(sessions, "all")).toHaveLength(3);
  });

  it("leaves out other apps for Chrome only", () => {
    expect(applyScope(sessions, "chrome").map((s) => s.category.name)).toEqual(["CODING", "MEDIA"]);
  });
});
