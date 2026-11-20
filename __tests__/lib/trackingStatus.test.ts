import { runTotals, toStatus, type RecordedStretch } from "@/lib/trackingStatus";

const at = (time: string) => new Date(`2026-11-20T${time}:00`);
const stretch = (startedAt: Date, end: Date, extra: Partial<RecordedStretch> = {}): RecordedStretch => ({
  startedAt,
  end,
  isIdle: false,
  productive: false,
  outside: false,
  ...extra
});

describe("runTotals", () => {
  const sessions = [
    stretch(new Date("2026-11-19T22:00:00"), new Date("2026-11-19T23:30:00")),
    stretch(at("09:00"), at("10:00"), { productive: true }),
    // computer asleep 10:00-14:00: no session
    stretch(at("14:00"), at("14:20"), { outside: true }),
    stretch(at("14:20"), at("14:30"), { isIdle: true })
  ];

  it("counts recorded time since play, not gaps", () => {
    expect(runTotals(sessions, at("08:00"), at("15:00"))).toEqual({
      recordedSeconds: 90 * 60,
      trackedSeconds: 80 * 60,
      productiveSeconds: 60 * 60,
      idleSeconds: 10 * 60,
      outsideSeconds: 20 * 60
    });
  });

  it("ignores what was recorded before play", () => {
    expect(runTotals(sessions, at("09:30"), at("15:00")).recordedSeconds).toBe(60 * 60);
  });

  it("keeps counting across midnight within one session", () => {
    expect(runTotals(sessions, new Date("2026-11-19T23:00:00"), at("15:00")).recordedSeconds).toBe(120 * 60);
  });

  it("is empty when stopped", () => {
    expect(runTotals(sessions, null, at("15:00")).recordedSeconds).toBe(0);
  });
});

describe("toStatus", () => {
  it("hides the run start once stopped", () => {
    expect(toStatus({ trackingState: "STOPPED", runStartedAt: at("09:00") })).toEqual({ state: "STOPPED", runStartedAt: null });
    expect(toStatus({ trackingState: "PAUSED", runStartedAt: at("09:00") }).runStartedAt).toBe(at("09:00").toISOString());
  });
});
