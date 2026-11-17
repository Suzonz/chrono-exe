import { hourlyBuckets } from "@/lib/hourly";
import type { TimelineBlock } from "@/types";

const day = new Date(2026, 10, 16).getTime();
const at = (h: number, m = 0) => new Date(2026, 10, 16, h, m).toISOString();
const cat = (name: string) => ({ id: name, name, color: "violet" as const, productivity: "NEUTRAL" as const, dailyLimitSeconds: null });
const block = (name: string, start: string, end: string, isIdle = false): TimelineBlock => ({
  sessionId: `${name}-${start}`,
  startTime: start,
  endTime: end,
  category: cat(name),
  isIdle,
  isActive: false,
  host: null
});

describe("hourlyBuckets", () => {
  const blocks = [block("CODING", at(9, 30), at(10, 15)), block("MEDIA", at(10, 15), at(10, 30)), block("IDLE", at(10, 30), at(10, 40), true), block("CODING", at(12, 0), at(12, 20))];
  const buckets = hourlyBuckets(blocks, day);

  it("covers the first to the last active hour, gaps included", () => {
    expect(buckets.map((bucket) => bucket.hour)).toEqual([9, 10, 11, 12]);
    expect(buckets[2].activeSeconds).toBe(0);
  });

  it("splits activities across hours and keeps away time apart", () => {
    expect(buckets[0].parts).toEqual([{ category: expect.objectContaining({ name: "CODING" }), seconds: 1800 }]);
    expect(buckets[1].activeSeconds).toBe(30 * 60);
    expect(buckets[1].idleSeconds).toBe(10 * 60);
    expect(buckets[1].parts.map((part) => part.category.name)).toEqual(["CODING", "MEDIA"]);
  });

  it("runs to the current hour for today", () => {
    const today = hourlyBuckets(blocks, day, new Date(2026, 10, 16, 14, 5).getTime());
    expect(today[today.length - 1].hour).toBe(14);
  });

  it("is empty without activity", () => {
    expect(hourlyBuckets([], day)).toEqual([]);
  });
});

describe("hourlyBuckets with a window", () => {
  it("returns exactly the requested hours, empty ones included", () => {
    const blocks: TimelineBlock[] = [
      { sessionId: "a", startTime: at(9), endTime: at(9, 30), category: cat("CODING"), isIdle: false, isActive: false, host: null }
    ];
    const window = hourlyBuckets(blocks, day, undefined, { from: 2, to: 10 });
    expect(window.map((bucket) => bucket.hour)).toEqual([2, 3, 4, 5, 6, 7, 8, 9]);
    expect(window[7].activeSeconds).toBe(1800);
  });
});
