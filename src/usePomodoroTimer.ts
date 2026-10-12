import { useCallback, useEffect, useRef, useState } from "react";
import { PomodoroTimerAudioEngine } from "./PomodoroAudioEngine";
import {
  POMODORO_TIMER_STATUS,
  PomodoroTimerScheduler,
  WORK_DURATION_SECONDS,
  type PomodoroTimerSchedulerState,
} from "./PomodoroScheduler";

const LOW_ALARM_THRESHOLD_SECONDS = 3;
const MILLISECONDS_PER_SECOND = 1000;

type PreparedClock = {
  currentTimeSeconds: number;
  getCurrentTimeSeconds: () => number | null;
};

const getPerformanceNowSeconds = () => performance.now() / MILLISECONDS_PER_SECOND;

const createPerformanceClock = (): PreparedClock => ({
  currentTimeSeconds: getPerformanceNowSeconds(),
  getCurrentTimeSeconds: getPerformanceNowSeconds,
});

export const usePomodoroTimer = () => {
  const [timerState, setTimerState] = useState<PomodoroTimerSchedulerState>({
    remainingSeconds: WORK_DURATION_SECONDS,
    cycleCount: 0,
    phase: POMODORO_TIMER_STATUS.IDLE,
    isPaused: false,
  });
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const audioEngineRef = useRef<PomodoroTimerAudioEngine | null>(null);
  const schedulerRef = useRef<PomodoroTimerScheduler | null>(null);
  const activeClockRef = useRef<PreparedClock | null>(null);

  const prepareClock = useCallback(async () => {
    try {
      const audioContext = await audioEngineRef.current?.prepare();
      if (audioContext) {
        const audioClock: PreparedClock = {
          currentTimeSeconds: audioContext.currentTime,
          getCurrentTimeSeconds: () => {
            const currentAudioContext = audioEngineRef.current?.getAudioContext();
            // Stop the timer if the prepared audio clock was replaced or disposed.
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
      if (import.meta.env.DEV) {
        console.warn(
          "usePomodoroTimer: audio clock unavailable, falling back to performance clock.",
        );
      }
    }

    const performanceClock = createPerformanceClock();
    activeClockRef.current = performanceClock;
    return performanceClock.currentTimeSeconds;
  }, []);

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
        if (import.meta.env.DEV) {
          console.warn("usePomodoroTimer: active clock became unavailable, timer stopped.");
        }
      },
      onStateChanged: (nextState) => {
        setTimerState(nextState);
      },
      onPhaseStarted: (phaseStartTimeSeconds: number, durationSeconds: number) => {
        const alarmTimeSeconds = phaseStartTimeSeconds + durationSeconds;
        const lowAlarmCount = Math.min(LOW_ALARM_THRESHOLD_SECONDS, Math.floor(durationSeconds));

        for (let remainingSeconds = lowAlarmCount; remainingSeconds >= 1; remainingSeconds -= 1) {
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
      void audioEngine.dispose().catch((error: unknown) => {
        if (import.meta.env.DEV) {
          console.warn("usePomodoroTimer: audio engine disposal failed.", error);
        }
      });
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
