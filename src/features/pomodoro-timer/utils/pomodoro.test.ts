import { describe, expect, it } from "vitest";
import { WORK_DURATION_SECONDS } from "../constants";
import { POMODORO_TIMER_STATUS } from "../schedulers/PomodoroTimerScheduler";
import {
  formatSecondsAsClock,
  getPomodoroColorForRemainingSeconds,
  resolveNextPomodoros,
  type Pomodoro,
} from "./pomodoro";

describe("pomodoro utils", () => {
  it("formats seconds as a clock string", () => {
    expect(formatSecondsAsClock(0)).toBe("00:00");
    expect(formatSecondsAsClock(65)).toBe("01:05");
    expect(formatSecondsAsClock(1500)).toBe("25:00");
  });

  it("maps work progress to a tomato color", () => {
    expect(
      getPomodoroColorForRemainingSeconds(
        WORK_DURATION_SECONDS,
        WORK_DURATION_SECONDS,
      ),
    ).toBe("rgb(64, 128, 0)");
    expect(getPomodoroColorForRemainingSeconds(0, WORK_DURATION_SECONDS)).toBe(
      "rgb(255, 32, 0)",
    );
  });

  it("adds the first pomodoro when work starts from idle", () => {
    const nextPomodoros = resolveNextPomodoros(
      [],
      {
        remainingSeconds: WORK_DURATION_SECONDS,
        cycleCount: 0,
        phase: POMODORO_TIMER_STATUS.IDLE,
        isPaused: false,
      },
      {
        remainingSeconds: WORK_DURATION_SECONDS,
        cycleCount: 0,
        phase: POMODORO_TIMER_STATUS.WORK,
        isPaused: false,
      },
      "rgb(64, 128, 0)",
      WORK_DURATION_SECONDS,
    );

    expect(nextPomodoros).toEqual([{ id: 0, color: "rgb(64, 128, 0)" }]);
  });

  it("updates the current pomodoro color while work is running", () => {
    const pomodoros: Pomodoro[] = [{ id: 0, color: "rgb(64, 128, 0)" }];

    const nextPomodoros = resolveNextPomodoros(
      pomodoros,
      {
        remainingSeconds: WORK_DURATION_SECONDS,
        cycleCount: 0,
        phase: POMODORO_TIMER_STATUS.WORK,
        isPaused: false,
      },
      {
        remainingSeconds: WORK_DURATION_SECONDS / 2,
        cycleCount: 0,
        phase: POMODORO_TIMER_STATUS.WORK,
        isPaused: false,
      },
      "rgb(64, 128, 0)",
      WORK_DURATION_SECONDS,
    );

    expect(nextPomodoros).toEqual([{ id: 0, color: "rgb(159, 80, 0)" }]);
  });

  it("marks the previous pomodoro complete when work transitions to a break", () => {
    const nextPomodoros = resolveNextPomodoros(
      [{ id: 0, color: "rgb(159, 80, 0)" }],
      {
        remainingSeconds: 1,
        cycleCount: 0,
        phase: POMODORO_TIMER_STATUS.WORK,
        isPaused: false,
      },
      {
        remainingSeconds: 300,
        cycleCount: 1,
        phase: POMODORO_TIMER_STATUS.SHORT_BREAK,
        isPaused: false,
      },
      "rgb(64, 128, 0)",
      WORK_DURATION_SECONDS,
    );

    expect(nextPomodoros).toEqual([{ id: 0, color: "rgb(255, 32, 0)" }]);
  });

  it("adds a new pomodoro when returning to work after a break", () => {
    const nextPomodoros = resolveNextPomodoros(
      [{ id: 0, color: "rgb(255, 32, 0)" }],
      {
        remainingSeconds: 1,
        cycleCount: 1,
        phase: POMODORO_TIMER_STATUS.SHORT_BREAK,
        isPaused: false,
      },
      {
        remainingSeconds: WORK_DURATION_SECONDS,
        cycleCount: 1,
        phase: POMODORO_TIMER_STATUS.WORK,
        isPaused: false,
      },
      "rgb(64, 128, 0)",
      WORK_DURATION_SECONDS,
    );

    expect(nextPomodoros).toEqual([
      { id: 0, color: "rgb(255, 32, 0)" },
      { id: 1, color: "rgb(64, 128, 0)" },
    ]);
  });
});
