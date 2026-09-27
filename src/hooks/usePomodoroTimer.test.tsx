/* @vitest-environment jsdom */
import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from "vite-plus/test";
import {
  POMODORO_TIMER_STATUS,
  WORK_DURATION_SECONDS,
  type PomodoroTimerSchedulerState,
} from "../lib/scheduler";
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";

const LOW_ALARM_THRESHOLD_SECONDS = 3;

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

type MockScheduler = {
  options: SchedulerOptions;
  start: Mock;
  pause: Mock;
  resume: Mock;
  reset: Mock;
  dispose: Mock;
};

type MockAudioEngine = {
  prepare: Mock;
  getAudioContext: Mock;
  stop: Mock;
  dispose: Mock;
  scheduleAlarm: Mock;
  scheduleLowAlarm: Mock;
};

const mockSchedulerInstances: MockScheduler[] = [];
const mockAudioEngineInstances: MockAudioEngine[] = [];
const mockSharedAudioContext = { currentTime: 100 };

vi.mock("../lib/scheduler", async () => {
  const actual = (await vi.importActual("../lib/scheduler")) as typeof import("../lib/scheduler");

  return {
    ...actual,
    PomodoroTimerScheduler: class implements MockScheduler {
      public readonly start = vi.fn(async () => true);
      public readonly pause = vi.fn();
      public readonly resume = vi.fn(async () => true);
      public readonly reset = vi.fn();
      public readonly dispose = vi.fn();

      public readonly options: SchedulerOptions;

      public constructor(options: SchedulerOptions) {
        this.options = options;
        mockSchedulerInstances.push(this);
      }
    },
  };
});

vi.mock("../lib/audioEngine", () => ({
  PomodoroTimerAudioEngine: class implements MockAudioEngine {
    public readonly prepare = vi.fn(async () => mockSharedAudioContext);
    public readonly getAudioContext = vi.fn(() => mockSharedAudioContext);
    public readonly stop = vi.fn();
    public readonly dispose = vi.fn(async () => {});
    public readonly scheduleAlarm = vi.fn();
    public readonly scheduleLowAlarm = vi.fn();

    public constructor() {
      mockAudioEngineInstances.push(this);
    }
  },
}));

import { usePomodoroTimer } from "./usePomodoroTimer";

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
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    mockSchedulerInstances.length = 0;
    mockAudioEngineInstances.length = 0;
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
    const scheduler = mockSchedulerInstances[0];
    const audioEngine = mockAudioEngineInstances[0];

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
    const scheduler = mockSchedulerInstances[0];

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
    const scheduler = mockSchedulerInstances[0];
    const audioEngine = mockAudioEngineInstances[0];

    act(() => {
      scheduler.options.onPhaseStarted?.(defaultState, 10, WORK_DURATION_SECONDS);
    });

    expect(audioEngine.scheduleLowAlarm).toHaveBeenCalledTimes(LOW_ALARM_THRESHOLD_SECONDS);
    expect(audioEngine.scheduleLowAlarm).toHaveBeenNthCalledWith(1, 1507);
    expect(audioEngine.scheduleLowAlarm).toHaveBeenNthCalledWith(2, 1508);
    expect(audioEngine.scheduleLowAlarm).toHaveBeenNthCalledWith(3, 1509);
    expect(audioEngine.scheduleAlarm).toHaveBeenCalledWith(1510);
  });

  it("shows an error when the active clock becomes unavailable", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    await renderHookHarness();
    const scheduler = mockSchedulerInstances[0];
    const audioEngine = mockAudioEngineInstances[0];

    act(() => {
      scheduler.options.onClockUnavailable?.();
    });

    expect(audioEngine.stop).toHaveBeenCalledTimes(1);
    expect(hookResult.errorMessage).toBe("The timer stopped unexpectedly. Please start again.");
    expect(warnSpy).toHaveBeenCalledWith(
      "usePomodoroTimer: active clock became unavailable, timer stopped.",
    );
    warnSpy.mockRestore();
  });
});
