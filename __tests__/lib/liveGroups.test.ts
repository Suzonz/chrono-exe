import { withLiveTime } from "@/lib/liveGroups";
import type { CategoryRef } from "@/types";

const category = (id: string): CategoryRef => ({ id, name: id.toUpperCase(), color: "cyan", productivity: "NEUTRAL", dailyLimitSeconds: null });

describe("withLiveTime", () => {
  it("fills the ring of a session that just started", () => {
    expect(withLiveTime([], 12, category("media"))).toEqual([{ category: category("media"), totalSeconds: 12, percentage: 100 }]);
  });

  it("adds the time since the last heartbeat to the current category", () => {
    const groups = [
      { category: category("coding"), totalSeconds: 60, percentage: 60 },
      { category: category("media"), totalSeconds: 40, percentage: 40 }
    ];
    const result = withLiveTime(groups, 200, category("media"));
    expect(result.map((group) => [group.category.id, group.totalSeconds, group.percentage])).toEqual([
      ["media", 140, 70],
      ["coding", 60, 30]
    ]);
  });

  it("changes nothing without a session in progress or extra time", () => {
    const groups = [{ category: category("coding"), totalSeconds: 60, percentage: 100 }];
    expect(withLiveTime(groups, 90, null)).toBe(groups);
    expect(withLiveTime(groups, 60, category("coding"))).toBe(groups);
  });
});
