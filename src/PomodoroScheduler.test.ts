import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";
import {
  LONG_BREAK_DURATION_SECONDS,
  POMODORO_TIMER_STATUS,
  PomodoroTimerScheduler,
  SHORT_BREAK_DURATION_SECONDS,
  WORK_DURATION_SECONDS,
} from "./PomodoroScheduler";

type Deferred<T> = {
  promise: Promise<T>;
  resolve: (value: T) => void;
};

const createDeferred = <T>() => {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((nextResolve) => {
    resolve = nextResolve;
  });

  return { promise, resolve } satisfies Deferred<T>;
};

const createSchedulerHarness = () => {
  let currentTimeSeconds = 0;
  const phaseStarts: Array<{
    phaseStartTimeSeconds: number;
    durationSeconds: number;
  }> = [];

  const scheduler = new PomodoroTimerScheduler({
    clock: {
      prepare: async () => currentTimeSeconds,
      getCurrentTimeSeconds: () => currentTimeSeconds,
    },
    onPhaseStarted: (phaseStartTimeSeconds, durationSeconds) => {
      phaseStarts.push({
        phaseStartTimeSeconds,
        durationSeconds,
      });
    },
  });

  return {
    scheduler,
    phaseStarts,
    setCurrentTimeSeconds: (nextCurrentTimeSeconds: number) => {
      currentTimeSeconds = nextCurrentTimeSeconds;
    },
  };
};

describe("PomodoroTimerScheduler", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("starts in work phase and notifies phase start once", async () => {
    const harness = createSchedulerHarness();

    await expect(harness.scheduler.start()).resolves.toBe(true);

    expect(harness.scheduler.getState()).toEqual({
      remainingSeconds: WORK_DURATION_SECONDS,
      cycleCount: 0,
      phase: POMODORO_TIMER_STATUS.WORK,
      isPaused: false,
    });
    expect(harness.phaseStarts).toEqual([
      {
        phaseStartTimeSeconds: 0,
        durationSeconds: WORK_DURATION_SECONDS,
      },
    ]);
  });

  it("transitions from work to short break when the work phase ends", async () => {
    const harness = createSchedulerHarness();
    await harness.scheduler.start();

    harness.setCurrentTimeSeconds(WORK_DURATION_SECONDS);
    await vi.advanceTimersByTimeAsync(1000);

    expect(harness.scheduler.getState()).toEqual({
      remainingSeconds: SHORT_BREAK_DURATION_SECONDS,
      cycleCount: 1,
      phase: POMODORO_TIMER_STATUS.SHORT_BREAK,
      isPaused: false,
    });
  });

  it("enters a long break after the fourth completed work phase", async () => {
    const harness = createSchedulerHarness();
    await harness.scheduler.start();
    let elapsedSeconds = 0;

    for (let cycleCount = 1; cycleCount <= 4; cycleCount += 1) {
      elapsedSeconds += WORK_DURATION_SECONDS;
      harness.setCurrentTimeSeconds(elapsedSeconds);
      await vi.advanceTimersByTimeAsync(1000);

      if (cycleCount < 4) {
        expect(harness.scheduler.getState().phase).toBe(POMODORO_TIMER_STATUS.SHORT_BREAK);
        elapsedSeconds += SHORT_BREAK_DURATION_SECONDS;
        harness.setCurrentTimeSeconds(elapsedSeconds);
      } else {
        expect(harness.scheduler.getState().phase).toBe(POMODORO_TIMER_STATUS.LONG_BREAK);
        expect(harness.scheduler.getState().remainingSeconds).toBe(LONG_BREAK_DURATION_SECONDS);
        break;
      }

      await vi.advanceTimersByTimeAsync(1000);
      expect(harness.scheduler.getState().phase).toBe(POMODORO_TIMER_STATUS.WORK);
    }
  });

  it("resumes a paused phase with its remaining duration", async () => {
    const harness = createSchedulerHarness();
    await harness.scheduler.start();

    harness.setCurrentTimeSeconds(30.25);
    await vi.advanceTimersByTimeAsync(1000);
    harness.scheduler.pause();

    expect(harness.scheduler.getState()).toEqual({
      remainingSeconds: 1470,
      cycleCount: 0,
      phase: POMODORO_TIMER_STATUS.WORK,
      isPaused: true,
    });

    harness.setCurrentTimeSeconds(100);
    await expect(harness.scheduler.resume()).resolves.toBe(true);
    harness.setCurrentTimeSeconds(101.25);
    await vi.advanceTimersByTimeAsync(1000);

    expect(harness.scheduler.getState()).toEqual({
      remainingSeconds: 1469,
      cycleCount: 0,
      phase: POMODORO_TIMER_STATUS.WORK,
      isPaused: false,
    });
  });

  it("stops and reports when the active clock becomes unavailable", async () => {
    let currentTimeSeconds: number | null = 0;
    const onClockUnavailable = vi.fn();
    const scheduler = new PomodoroTimerScheduler({
      clock: {
        prepare: async () => 0,
        getCurrentTimeSeconds: () => currentTimeSeconds,
      },
      onClockUnavailable,
    });
    await scheduler.start();

    currentTimeSeconds = null;
    await vi.advanceTimersByTimeAsync(1000);

    expect(scheduler.getState()).toEqual({
      remainingSeconds: WORK_DURATION_SECONDS,
      cycleCount: 0,
      phase: POMODORO_TIMER_STATUS.IDLE,
      isPaused: false,
    });
    expect(onClockUnavailable).toHaveBeenCalledTimes(1);
  });

  it("prevents duplicate starts while clock preparation is pending", async () => {
    const deferred = createDeferred<number>();
    const phaseStarts: number[] = [];
    const scheduler = new PomodoroTimerScheduler({
      clock: {
        prepare: () => deferred.promise,
        getCurrentTimeSeconds: () => 0,
      },
      onPhaseStarted: () => {
        phaseStarts.push(1);
      },
    });

    const firstStartPromise = scheduler.start();
    await expect(scheduler.start()).resolves.toBe(false);

    deferred.resolve(0);

    await expect(firstStartPromise).resolves.toBe(true);
    expect(phaseStarts).toHaveLength(1);
    expect(scheduler.getState().phase).toBe(POMODORO_TIMER_STATUS.WORK);
  });

  it("invalidates a pending start when reset is called before preparation finishes", async () => {
    const deferred = createDeferred<number>();
    const scheduler = new PomodoroTimerScheduler({
      clock: {
        prepare: () => deferred.promise,
        getCurrentTimeSeconds: () => 0,
      },
    });

    const startPromise = scheduler.start();
    scheduler.reset();
    deferred.resolve(0);

    await expect(startPromise).resolves.toBe(false);
    expect(scheduler.getState()).toEqual({
      remainingSeconds: WORK_DURATION_SECONDS,
      cycleCount: 0,
      phase: POMODORO_TIMER_STATUS.IDLE,
      isPaused: false,
    });
  });

  it("keeps a new clock preparation locked when an older request finishes", async () => {
    const firstPreparation = createDeferred<number>();
    const secondPreparation = createDeferred<number>();
    let preparationCount = 0;
    const scheduler = new PomodoroTimerScheduler({
      clock: {
        prepare: () => {
          preparationCount += 1;
          return preparationCount === 1 ? firstPreparation.promise : secondPreparation.promise;
        },
        getCurrentTimeSeconds: () => 0,
      },
    });

    const firstStartPromise = scheduler.start();
    scheduler.reset();
    const secondStartPromise = scheduler.start();

    firstPreparation.resolve(0);
    await expect(firstStartPromise).resolves.toBe(false);

    const duplicateStartPromise = scheduler.start();
    expect(preparationCount).toBe(2);

    secondPreparation.resolve(100);
    await expect(secondStartPromise).resolves.toBe(true);
    await expect(duplicateStartPromise).resolves.toBe(false);
  });
});
