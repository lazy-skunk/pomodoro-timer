import { useCallback, useEffect, useRef, useState } from "react";
import { PomodoroTimerAudioEngine } from "@/features/pomodoro-timer/services/audio/PomodoroTimerAudioEngine";
import {
  LOW_ALARM_THRESHOLD_SECONDS,
  WORK_DURATION_SECONDS,
} from "@/features/pomodoro-timer/constants";
import {
  POMODORO_TIMER_STATUS,
  PomodoroTimerScheduler,
  type PomodoroTimerSchedulerState,
} from "@/features/pomodoro-timer/services/schedulers/PomodoroTimerScheduler";
import {
  resolveNextPomodoros,
  type Pomodoro,
} from "@/features/pomodoro-timer/utils/pomodoro";

type UsePomodoroTimerOptions = {
  basePomodoroColor: string;
};

type PreparedClock = {
  currentTimeSeconds: number;
  getCurrentTimeSeconds: () => number | null;
};

export const usePomodoroTimer = ({
  basePomodoroColor,
}: UsePomodoroTimerOptions) => {
  const [timerState, setTimerState] = useState<PomodoroTimerSchedulerState>({
    remainingSeconds: WORK_DURATION_SECONDS,
    cycleCount: 0,
    phase: POMODORO_TIMER_STATUS.IDLE,
    isPaused: false,
  });
  const [pomodoros, setPomodoros] = useState<Pomodoro[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const audioEngineRef = useRef<PomodoroTimerAudioEngine | null>(null);
  const schedulerRef = useRef<PomodoroTimerScheduler | null>(null);
  const previousTimerStateRef = useRef(timerState);
  const basePomodoroColorRef = useRef(basePomodoroColor);
  const activeClockRef = useRef<PreparedClock | null>(null);

  useEffect(() => {
    basePomodoroColorRef.current = basePomodoroColor;
  }, [basePomodoroColor]);

  const getPerformanceNowSeconds = useCallback(
    () => performance.now() / 1000,
    [],
  );

  const createPerformanceClock = useCallback((): PreparedClock => {
    return {
      currentTimeSeconds: getPerformanceNowSeconds(),
      getCurrentTimeSeconds: getPerformanceNowSeconds,
    };
  }, [getPerformanceNowSeconds]);

  const prepareClock = useCallback(async () => {
    try {
      const audioContext = await audioEngineRef.current?.prepare();
      if (audioContext) {
        const audioClock: PreparedClock = {
          currentTimeSeconds: audioContext.currentTime,
          getCurrentTimeSeconds: () => {
            const currentAudioContext =
              audioEngineRef.current?.getAudioContext();
            if (!currentAudioContext || currentAudioContext !== audioContext) {
              return null;
            }

            return currentAudioContext.currentTime;
          },
        };
        activeClockRef.current = audioClock;
        return audioClock.currentTimeSeconds;
      }
    } catch {
      if (process.env.NODE_ENV !== "production") {
        console.warn(
          "usePomodoroTimer: audio clock unavailable, falling back to performance clock.",
        );
      }
    }

    const performanceClock = createPerformanceClock();
    activeClockRef.current = performanceClock;
    return performanceClock.currentTimeSeconds;
  }, [createPerformanceClock]);

  const getCurrentTimeSeconds = useCallback(() => {
    return activeClockRef.current?.getCurrentTimeSeconds() ?? null;
  }, []);

  useEffect(() => {
    const audioEngine = new PomodoroTimerAudioEngine();
    const scheduler = new PomodoroTimerScheduler({
      clock: {
        prepare: prepareClock,
        getCurrentTimeSeconds,
      },
      onClockUnavailable: () => {
        activeClockRef.current = null;
        audioEngine.stop();
        setErrorMessage("The timer stopped unexpectedly. Please start again.");
        if (process.env.NODE_ENV !== "production") {
          console.warn(
            "usePomodoroTimer: active clock became unavailable, timer stopped.",
          );
        }
      },
      onStateChanged: (nextState) => {
        const previousState = previousTimerStateRef.current;
        previousTimerStateRef.current = nextState;
        setTimerState(nextState);
        setPomodoros((previousPomodoros) => {
          if (nextState.phase === POMODORO_TIMER_STATUS.IDLE) {
            return [];
          }

          return resolveNextPomodoros(
            previousPomodoros,
            previousState,
            nextState,
            basePomodoroColorRef.current,
            WORK_DURATION_SECONDS,
          );
        });
      },
      onPhaseStarted: (
        _state: PomodoroTimerSchedulerState,
        phaseStartTimeSeconds: number,
        durationSeconds: number,
      ) => {
        const alarmTimeSeconds = phaseStartTimeSeconds + durationSeconds;
        const lowAlarmCount = Math.min(
          LOW_ALARM_THRESHOLD_SECONDS,
          Math.floor(durationSeconds),
        );

        for (
          let remainingSeconds = lowAlarmCount;
          remainingSeconds >= 1;
          remainingSeconds -= 1
        ) {
          audioEngine.scheduleLowAlarm(alarmTimeSeconds - remainingSeconds);
        }

        audioEngine.scheduleAlarm(alarmTimeSeconds);
      },
    });
    audioEngineRef.current = audioEngine;
    schedulerRef.current = scheduler;

    return () => {
      scheduler.dispose();
      schedulerRef.current = null;
      activeClockRef.current = null;
      void audioEngine.dispose();
      audioEngineRef.current = null;
    };
  }, [getCurrentTimeSeconds, prepareClock]);

  const startTimer = async () => {
    setErrorMessage(null);
    const didStart = await schedulerRef.current?.start();
    return didStart ?? false;
  };

  const pauseTimer = () => {
    audioEngineRef.current?.stop();
    schedulerRef.current?.pause();
  };

  const resumeTimer = async () => {
    setErrorMessage(null);
    return (await schedulerRef.current?.resume()) ?? false;
  };

  const resetTimer = () => {
    audioEngineRef.current?.stop();
    schedulerRef.current?.reset();
    activeClockRef.current = null;
    setErrorMessage(null);
  };

  const phase = timerState.phase;
  const isPaused = timerState.isPaused;

  return {
    timerState,
    pomodoros,
    errorMessage,
    canStart: phase === POMODORO_TIMER_STATUS.IDLE,
    canPause: phase !== POMODORO_TIMER_STATUS.IDLE && !isPaused,
    canResume: isPaused,
    canReset: phase !== POMODORO_TIMER_STATUS.IDLE,
    startTimer,
    pauseTimer,
    resumeTimer,
    resetTimer,
  };
};
