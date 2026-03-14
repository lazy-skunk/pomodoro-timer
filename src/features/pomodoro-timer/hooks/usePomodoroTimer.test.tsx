// @vitest-environment jsdom

import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  LOW_ALARM_THRESHOLD_SECONDS,
  WORK_DURATION_SECONDS,
} from "@/features/pomodoro-timer/constants";
import {
  POMODORO_TIMER_STATUS,
  type PomodoroTimerSchedulerState,
} from "@/features/pomodoro-timer/services/schedulers/PomodoroTimerScheduler";

type SchedulerOptions = {
  clock: {
    prepare: () => Promise<number>;
    getCurrentTimeSeconds: () => number | null;
  };
  onStateChanged?: (state: PomodoroTimerSchedulerState) => void;
  onClockUnavailable?: () => void;
  onPhaseStarted?: (
    state: PomodoroTimerSchedulerState,
    phaseStartTimeSeconds: number,
    durationSeconds: number,
  ) => void;
};

const testDoubles = vi.hoisted(() => {
  const schedulerInstances: MockScheduler[] = [];
  const audioEngineInstances: MockAudioEngine[] = [];
  const sharedAudioContext = { currentTime: 100 };

  class MockScheduler {
    public readonly start = vi.fn(async () => true);
    public readonly pause = vi.fn();
    public readonly resume = vi.fn(async () => true);
    public readonly reset = vi.fn();
    public readonly dispose = vi.fn();

    public constructor(public readonly options: SchedulerOptions) {
      schedulerInstances.push(this);
    }
  }

  class MockAudioEngine {
    public readonly prepare = vi.fn(async () => sharedAudioContext);
    public readonly getAudioContext = vi.fn(() => sharedAudioContext);
    public readonly stop = vi.fn();
    public readonly dispose = vi.fn(async () => {});
    public readonly scheduleAlarm = vi.fn();
    public readonly scheduleLowAlarm = vi.fn();

    public constructor() {
      audioEngineInstances.push(this);
    }
  }

  return {
    schedulerInstances,
    audioEngineInstances,
    MockScheduler,
    MockAudioEngine,
  };
});

vi.mock(
  "@/features/pomodoro-timer/services/schedulers/PomodoroTimerScheduler",
  async () => {
    const actual = await vi.importActual<
      typeof import("@/features/pomodoro-timer/services/schedulers/PomodoroTimerScheduler")
    >("@/features/pomodoro-timer/services/schedulers/PomodoroTimerScheduler");

    return {
      ...actual,
      PomodoroTimerScheduler: testDoubles.MockScheduler,
    };
  },
);

vi.mock(
  "@/features/pomodoro-timer/services/audio/PomodoroTimerAudioEngine",
  () => ({
    PomodoroTimerAudioEngine: testDoubles.MockAudioEngine,
  }),
);

import { usePomodoroTimer } from "@/features/pomodoro-timer/hooks/usePomodoroTimer";

type HookResult = ReturnType<typeof usePomodoroTimer>;

const defaultState: PomodoroTimerSchedulerState = {
  remainingSeconds: WORK_DURATION_SECONDS,
  cycleCount: 0,
  phase: POMODORO_TIMER_STATUS.IDLE,
  isPaused: false,
};

describe("usePomodoroTimer", () => {
  let container: HTMLDivElement;
  let root: Root;
  let hookResult!: HookResult;

  beforeEach(() => {
    // React 19 expects this flag in custom test environments.
    globalThis.IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    testDoubles.schedulerInstances.length = 0;
    testDoubles.audioEngineInstances.length = 0;
  });

  afterEach(async () => {
    await act(async () => {
      root.unmount();
    });
    container.remove();
    vi.clearAllMocks();
  });

  const renderHookHarness = async (basePomodoroColor = "rgb(64, 128, 0)") => {
    function Harness({ onValue }: { onValue: (value: HookResult) => void }) {
      const value = usePomodoroTimer({ basePomodoroColor });

      React.useEffect(() => {
        onValue(value);
      }, [onValue, value]);

      return null;
    }

    await act(async () => {
      root.render(
        <Harness
          onValue={(value) => {
            hookResult = value;
          }}
        />,
      );
    });
  };

  it("exposes the idle state by default", async () => {
    await renderHookHarness();

    expect(hookResult.timerState).toEqual(defaultState);
    expect(hookResult.canStart).toBe(true);
    expect(hookResult.canPause).toBe(false);
    expect(hookResult.canResume).toBe(false);
    expect(hookResult.canReset).toBe(false);
  });

  it("delegates start, pause, resume, and reset actions", async () => {
    await renderHookHarness();
    const scheduler = testDoubles.schedulerInstances[0];
    const audioEngine = testDoubles.audioEngineInstances[0];

    await act(async () => {
      await hookResult.startTimer();
      await hookResult.resumeTimer();
    });
    act(() => {
      hookResult.pauseTimer();
      hookResult.resetTimer();
    });

    expect(scheduler.start).toHaveBeenCalledTimes(1);
    expect(scheduler.resume).toHaveBeenCalledTimes(1);
    expect(scheduler.pause).toHaveBeenCalledTimes(1);
    expect(scheduler.reset).toHaveBeenCalledTimes(1);
    expect(audioEngine.stop).toHaveBeenCalledTimes(2);
  });

  it("updates derived UI state and pomodoros from scheduler state changes", async () => {
    await renderHookHarness();
    const scheduler = testDoubles.schedulerInstances[0];

    act(() => {
      scheduler.options.onStateChanged?.({
        remainingSeconds: WORK_DURATION_SECONDS,
        cycleCount: 0,
        phase: POMODORO_TIMER_STATUS.WORK,
        isPaused: false,
      });
    });

    expect(hookResult.timerState.phase).toBe(POMODORO_TIMER_STATUS.WORK);
    expect(hookResult.canPause).toBe(true);
    expect(hookResult.pomodoros).toEqual([{ id: 0, color: "rgb(64, 128, 0)" }]);
  });

  it("schedules low alarms and a final alarm for each phase start", async () => {
    await renderHookHarness();
    const scheduler = testDoubles.schedulerInstances[0];
    const audioEngine = testDoubles.audioEngineInstances[0];

    act(() => {
      scheduler.options.onPhaseStarted?.(
        defaultState,
        10,
        WORK_DURATION_SECONDS,
      );
    });

    expect(audioEngine.scheduleLowAlarm).toHaveBeenCalledTimes(
      LOW_ALARM_THRESHOLD_SECONDS,
    );
    expect(audioEngine.scheduleLowAlarm).toHaveBeenNthCalledWith(1, 1507);
    expect(audioEngine.scheduleLowAlarm).toHaveBeenNthCalledWith(2, 1508);
    expect(audioEngine.scheduleLowAlarm).toHaveBeenNthCalledWith(3, 1509);
    expect(audioEngine.scheduleAlarm).toHaveBeenCalledWith(1510);
  });

  it("shows an error when the active clock becomes unavailable", async () => {
    await renderHookHarness();
    const scheduler = testDoubles.schedulerInstances[0];
    const audioEngine = testDoubles.audioEngineInstances[0];

    act(() => {
      scheduler.options.onClockUnavailable?.();
    });

    expect(audioEngine.stop).toHaveBeenCalledTimes(1);
    expect(hookResult.errorMessage).toBe(
      "The timer stopped unexpectedly. Please start again.",
    );
  });
});
