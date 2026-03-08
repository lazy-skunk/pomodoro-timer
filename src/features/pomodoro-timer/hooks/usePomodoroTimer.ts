import { useCallback, useEffect, useRef, useState } from "react";
import { PomodoroTimerAudioEngine } from "../audio/PomodoroTimerAudioEngine";
import {
  LONG_BREAK_DURATION_SECONDS,
  LOW_ALARM_THRESHOLD_SECONDS,
  MAX_CYCLE_COUNT,
  SHORT_BREAK_DURATION_SECONDS,
  WORK_DURATION_SECONDS,
} from "../constants";
import { getPomodoroColorForRemainingSeconds } from "../utils/pomodoro";

const TIMER_STATUS = {
  IDLE: "idle",
  WORK: "work",
  BREAK: "break",
  PAUSED: "paused",
} as const;

const STATUS_TEXT = {
  READY: "Ready",
  PAUSED: "Paused",
  WORK: "Work",
  LONG_BREAK: "Long Break",
  SHORT_BREAK: "Short Break",
} as const;

type TimerStatus = (typeof TIMER_STATUS)[keyof typeof TIMER_STATUS];
type RunningStatus = typeof TIMER_STATUS.WORK | typeof TIMER_STATUS.BREAK;

type Pomodoro = {
  id: number;
  color: string;
};

const basePomodoroColor = "rgb(64, 128, 0)";
const TICK_INTERVAL_MILLISECONDS = 250;
const MILLISECONDS_PER_SECOND = 1000;

export const usePomodoroTimer = () => {
  const [remainingSeconds, setRemainingSeconds] = useState(
    WORK_DURATION_SECONDS,
  );
  const [cycleCount, setCycleCount] = useState(0);
  const [status, setStatus] = useState<TimerStatus>(TIMER_STATUS.IDLE);
  const [pomodoros, setPomodoros] = useState<Pomodoro[]>([]);

  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const audioEngineRef = useRef<PomodoroTimerAudioEngine | null>(null);
  const endTimeRef = useRef<number | null>(null);
  const lastLowAlarmSecondRef = useRef<number | null>(null);
  const statusRef = useRef(status);
  const remainingSecondsRef = useRef(remainingSeconds);
  const cycleCountRef = useRef(cycleCount);
  const pausedStatusRef = useRef<RunningStatus>(TIMER_STATUS.WORK);

  useEffect(() => {
    const audioEngine = new PomodoroTimerAudioEngine();
    audioEngineRef.current = audioEngine;

    return () => {
      void audioEngine.dispose();
      audioEngineRef.current = null;
    };
  }, []);

  useEffect(() => {
    statusRef.current = status;
  }, [status]);

  useEffect(() => {
    remainingSecondsRef.current = remainingSeconds;
  }, [remainingSeconds]);

  useEffect(() => {
    cycleCountRef.current = cycleCount;
  }, [cycleCount]);

  const updatePomodoroColor = useCallback(
    (cycleIndex: number, remainingSecondsValue: number) => {
      const color = getPomodoroColorForRemainingSeconds(
        remainingSecondsValue,
        WORK_DURATION_SECONDS,
      );
      setPomodoros((previousPomodoros) =>
        previousPomodoros.map((pomodoro) =>
          pomodoro.id === cycleIndex ? { ...pomodoro, color } : pomodoro,
        ),
      );
    },
    [],
  );

  const addPomodoro = useCallback((cycleIndex: number) => {
    setPomodoros((previousPomodoros) => {
      if (previousPomodoros.some((pomodoro) => pomodoro.id === cycleIndex)) {
        return previousPomodoros;
      }
      return [
        ...previousPomodoros,
        { id: cycleIndex, color: basePomodoroColor },
      ];
    });
  }, []);

  const tick = useCallback(() => {
    const currentStatus = statusRef.current;
    if (
      currentStatus === TIMER_STATUS.IDLE ||
      currentStatus === TIMER_STATUS.PAUSED
    ) {
      return;
    }
    const endTime = endTimeRef.current;
    if (!endTime) {
      return;
    }
    const now = performance.now();
    const remainingMilliseconds = endTime - now;
    const nextRemainingSeconds = Math.max(
      0,
      Math.ceil(remainingMilliseconds / MILLISECONDS_PER_SECOND),
    );
    const cycleIndex = cycleCountRef.current;

    if (remainingMilliseconds > 0) {
      setRemainingSeconds(nextRemainingSeconds);
      remainingSecondsRef.current = nextRemainingSeconds;

      if (nextRemainingSeconds > LOW_ALARM_THRESHOLD_SECONDS) {
        lastLowAlarmSecondRef.current = null;
      } else if (nextRemainingSeconds <= LOW_ALARM_THRESHOLD_SECONDS) {
        if (lastLowAlarmSecondRef.current !== nextRemainingSeconds) {
          audioEngineRef.current?.playLowAlarm();
          lastLowAlarmSecondRef.current = nextRemainingSeconds;
        }
      }

      if (currentStatus === TIMER_STATUS.WORK) {
        updatePomodoroColor(cycleIndex, nextRemainingSeconds);
      }

      return;
    }

    audioEngineRef.current?.playAlarm();
    endTimeRef.current = null;

    if (currentStatus === TIMER_STATUS.BREAK) {
      addPomodoro(cycleIndex);
    } else if (currentStatus === TIMER_STATUS.WORK) {
      updatePomodoroColor(cycleIndex, 0);
    }

    if (currentStatus === TIMER_STATUS.WORK) {
      const nextCycleCount = cycleIndex + 1;
      setCycleCount(nextCycleCount);
      cycleCountRef.current = nextCycleCount;
      setStatus(TIMER_STATUS.BREAK);
      const isLongBreak = nextCycleCount % MAX_CYCLE_COUNT === 0;
      const nextSeconds = isLongBreak
        ? LONG_BREAK_DURATION_SECONDS
        : SHORT_BREAK_DURATION_SECONDS;
      setRemainingSeconds(nextSeconds);
      remainingSecondsRef.current = nextSeconds;
      endTimeRef.current =
        performance.now() + nextSeconds * MILLISECONDS_PER_SECOND;
      lastLowAlarmSecondRef.current = null;
    } else {
      setStatus(TIMER_STATUS.WORK);
      setRemainingSeconds(WORK_DURATION_SECONDS);
      remainingSecondsRef.current = WORK_DURATION_SECONDS;
      endTimeRef.current =
        performance.now() + WORK_DURATION_SECONDS * MILLISECONDS_PER_SECOND;
      lastLowAlarmSecondRef.current = null;
    }
  }, [addPomodoro, updatePomodoroColor]);

  useEffect(() => {
    const isRunning =
      status === TIMER_STATUS.WORK || status === TIMER_STATUS.BREAK;
    if (!isRunning) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }

    if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }
    intervalRef.current = setInterval(tick, TICK_INTERVAL_MILLISECONDS);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [status, tick]);

  useEffect(() => {
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, []);

  const handleStart = async () => {
    if (status !== TIMER_STATUS.IDLE) {
      return;
    }
    await audioEngineRef.current?.warmUp();
    setStatus(TIMER_STATUS.WORK);
    setRemainingSeconds(WORK_DURATION_SECONDS);
    remainingSecondsRef.current = WORK_DURATION_SECONDS;
    endTimeRef.current =
      performance.now() + WORK_DURATION_SECONDS * MILLISECONDS_PER_SECOND;
    lastLowAlarmSecondRef.current = null;
    addPomodoro(cycleCountRef.current);
  };

  const handlePause = () => {
    if (status === TIMER_STATUS.WORK || status === TIMER_STATUS.BREAK) {
      pausedStatusRef.current = status;
      setStatus(TIMER_STATUS.PAUSED);
      endTimeRef.current = null;
    }
  };

  const handleResume = async () => {
    if (status === TIMER_STATUS.PAUSED) {
      await audioEngineRef.current?.warmUp();
      setStatus(pausedStatusRef.current);
      endTimeRef.current =
        performance.now() +
        remainingSecondsRef.current * MILLISECONDS_PER_SECOND;
    }
  };

  const handleReset = () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    setRemainingSeconds(WORK_DURATION_SECONDS);
    setCycleCount(0);
    cycleCountRef.current = 0;
    remainingSecondsRef.current = WORK_DURATION_SECONDS;
    pausedStatusRef.current = TIMER_STATUS.WORK;
    setPomodoros([]);
    setStatus(TIMER_STATUS.IDLE);
    endTimeRef.current = null;
    lastLowAlarmSecondRef.current = null;
  };

  const statusText = (() => {
    if (status === TIMER_STATUS.IDLE) {
      return STATUS_TEXT.READY;
    }
    if (status === TIMER_STATUS.PAUSED) {
      return STATUS_TEXT.PAUSED;
    }
    if (status === TIMER_STATUS.WORK) {
      return STATUS_TEXT.WORK;
    }
    if (status === TIMER_STATUS.BREAK) {
      return cycleCount % MAX_CYCLE_COUNT === 0
        ? STATUS_TEXT.LONG_BREAK
        : STATUS_TEXT.SHORT_BREAK;
    }
    return "";
  })();

  const shouldShowStartButton = status === TIMER_STATUS.IDLE;
  const shouldShowPauseButton =
    status === TIMER_STATUS.WORK || status === TIMER_STATUS.BREAK;
  const shouldShowResumeButton = status === TIMER_STATUS.PAUSED;
  const shouldShowResetButton = status !== TIMER_STATUS.IDLE;

  return {
    remainingSeconds,
    pomodoros,
    statusText,
    shouldShowStartButton,
    shouldShowPauseButton,
    shouldShowResumeButton,
    shouldShowResetButton,
    handleStart,
    handlePause,
    handleResume,
    handleReset,
  };
};
