import { isLauncherManaged, scheduleShutdown } from "@/lib/launcher";

describe("launcher lifecycle", () => {
  afterEach(() => {
    delete process.env.CHRONO_LAUNCHER;
  });

  it("is managed only when the launcher started the server", () => {
    expect(isLauncherManaged()).toBe(false);
    process.env.CHRONO_LAUNCHER = "1";
    expect(isLauncherManaged()).toBe(true);
  });

  it("shuts down once, after a delay", () => {
    jest.useFakeTimers();
    const exit = jest.fn();
    expect(scheduleShutdown(exit, 1000)).toBe(true);
    expect(scheduleShutdown(exit, 1000)).toBe(false);
    expect(exit).not.toHaveBeenCalled();
    jest.advanceTimersByTime(1000);
    expect(exit).toHaveBeenCalledTimes(1);
    jest.useRealTimers();
    delete (globalThis as { __chronoShutdown?: unknown }).__chronoShutdown;
  });
});
