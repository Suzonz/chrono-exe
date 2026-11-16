import {
  addDays,
  addMonths,
  dayRange,
  daysInMonth,
  formatCompact,
  formatDuration,
  overlapSeconds,
  parseHoursMinutes,
  startOfWeekKey,
  toDateKey,
  toHoursMinutes
} from "@/lib/time";

describe("calendar helpers", () => {
  it("round-trips local date keys", () => {
    expect(toDateKey(new Date(2026, 10, 16, 23, 59))).toBe("2026-11-16");
    expect(addDays("2026-11-30", 1)).toBe("2026-12-01");
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
  });

  it("adds months from the first of the month", () => {
    expect(addMonths("2026-01-31", 1)).toBe("2026-02-01");
    expect(addMonths("2026-01-15", -1)).toBe("2025-12-01");
  });

  it("finds the Monday of a week", () => {
    expect(startOfWeekKey("2026-11-16")).toBe("2026-11-16"); // Monday
    expect(startOfWeekKey("2026-11-22")).toBe("2026-11-16"); // Sunday
  });

  it("knows month lengths", () => {
    expect(daysInMonth("2028-02-10")).toBe(29);
    expect(daysInMonth("2026-11-01")).toBe(30);
  });

  it("builds half-open local day ranges", () => {
    const { start, end } = dayRange("2026-11-16");
    expect(start.getHours()).toBe(0);
    expect(toDateKey(end)).toBe("2026-11-17");
  });
});

describe("overlapSeconds", () => {
  const at = (h: number, m = 0) => new Date(2026, 10, 16, h, m);
  it("clips to the range", () => {
    expect(overlapSeconds(at(9), at(10), at(9, 30), at(12))).toBe(1800);
    expect(overlapSeconds(at(9), at(10), at(11), at(12))).toBe(0);
  });
});

describe("formatting", () => {
  it("formats durations", () => {
    expect(formatDuration(0)).toBe("00:00:00");
    expect(formatDuration(3725)).toBe("01:02:05");
    expect(formatDuration(-5)).toBe("00:00:00");
    expect(formatCompact(7500)).toBe("2H 05M");
    expect(formatCompact(840)).toBe("14M");
    expect(formatCompact(45)).toBe("45S");
  });

  it("parses HH:MM goals", () => {
    expect(parseHoursMinutes("08:00")).toBe(28800);
    expect(parseHoursMinutes("7:30")).toBe(27000);
    expect(parseHoursMinutes("25:00")).toBeNull();
    expect(parseHoursMinutes("abc")).toBeNull();
    expect(toHoursMinutes(27000)).toBe("07:30");
  });
});
