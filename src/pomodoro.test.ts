import { describe, expect, it } from "vite-plus/test";

import {
  formatSecondsAsClock,
  getPomodoroColorForRemainingSeconds,
  resolvePomodoros,
} from "./pomodoro";
import { POMODORO_TIMER_STATUS, WORK_DURATION_SECONDS } from "./PomodoroScheduler";

describe("pomodoro utils", () => {
  it("formats seconds as a clock string", () => {
    expect(formatSecondsAsClock(0)).toBe("00:00");
    expect(formatSecondsAsClock(65)).toBe("01:05");
    expect(formatSecondsAsClock(1500)).toBe("25:00");
  });

  it("maps work progress to a tomato color", () => {
    expect(getPomodoroColorForRemainingSeconds(WORK_DURATION_SECONDS, WORK_DURATION_SECONDS)).toBe(
      "rgb(64, 128, 0)",
    );
    expect(getPomodoroColorForRemainingSeconds(0, WORK_DURATION_SECONDS)).toBe("rgb(255, 32, 0)");
  });

  it("clamps tomato colors outside the work duration", () => {
    expect(
      getPomodoroColorForRemainingSeconds(WORK_DURATION_SECONDS + 1, WORK_DURATION_SECONDS),
    ).toBe("rgb(64, 128, 0)");
    expect(getPomodoroColorForRemainingSeconds(-1, WORK_DURATION_SECONDS)).toBe("rgb(255, 32, 0)");
    expect(getPomodoroColorForRemainingSeconds(0, 0)).toBe("rgb(255, 32, 0)");
  });

  it("returns no pomodoros while idle", () => {
    expect(
      resolvePomodoros({
        remainingSeconds: WORK_DURATION_SECONDS,
        cycleCount: 0,
        phase: POMODORO_TIMER_STATUS.IDLE,
        isPaused: false,
      }),
    ).toEqual([]);
  });

  it("returns completed pomodoros and the current work pomodoro", () => {
    expect(
      resolvePomodoros({
        remainingSeconds: WORK_DURATION_SECONDS / 2,
        cycleCount: 1,
        phase: POMODORO_TIMER_STATUS.WORK,
        isPaused: false,
      }),
    ).toEqual([
      { id: 0, color: "rgb(255, 32, 0)" },
      { id: 1, color: "rgb(159, 80, 0)" },
    ]);
  });

  it("returns only completed pomodoros during a break", () => {
    expect(
      resolvePomodoros({
        remainingSeconds: 300,
        cycleCount: 2,
        phase: POMODORO_TIMER_STATUS.SHORT_BREAK,
        isPaused: false,
      }),
    ).toEqual([
      { id: 0, color: "rgb(255, 32, 0)" },
      { id: 1, color: "rgb(255, 32, 0)" },
    ]);
  });
});
