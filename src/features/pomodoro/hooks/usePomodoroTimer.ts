import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type RefObject,
} from "react";
import {
  LONG_BREAK_DURATION_SECONDS,
  LOW_ALARM_THRESHOLD_SECONDS,
  MAX_CYCLE_COUNT,
  SHORT_BREAK_DURATION_SECONDS,
  WORK_DURATION_SECONDS,
} from "../constants";
import { getPomodoroColorForRemainingSeconds } from "../utils/pomodoro";

type TimerStatus = "idle" | "work" | "break" | "paused";

type Pomodoro = {
  id: number;
  color: string;
};

const basePomodoroColor = "rgb(64, 128, 0)";
const TICK_INTERVAL_MILLISECONDS = 250;

export const usePomodoroTimer = () => {
  const [remainingSeconds, setRemainingSeconds] = useState(
    WORK_DURATION_SECONDS
  );
  const [cycleCount, setCycleCount] = useState(0);
  const [status, setStatus] = useState<TimerStatus>("idle");
  const [pomodoros, setPomodoros] = useState<Pomodoro[]>([]);

  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const alarmRef = useRef<HTMLAudioElement | null>(null);
  const lowAlarmRef = useRef<HTMLAudioElement | null>(null);
  const endTimeRef = useRef<number | null>(null);
  const lastLowAlarmSecondRef = useRef<number | null>(null);
  const statusRef = useRef(status);
  const remainingSecondsRef = useRef(remainingSeconds);
  const cycleCountRef = useRef(cycleCount);
  const pausedStatusRef = useRef<"work" | "break">("work");

  useEffect(() => {
    alarmRef.current = new Audio("/alarm.wav");
    lowAlarmRef.current = new Audio("/low_alarm.wav");
    alarmRef.current.load();
    lowAlarmRef.current.load();
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

  const playAlarm = (ref: RefObject<HTMLAudioElement | null>) => {
    if (!ref.current) {
      return;
    }
    ref.current.currentTime = 0;
    ref.current.play();
  };

  const updatePomodoroColor = useCallback(
    (cycleIndex: number, remainingSecondsValue: number) => {
      const color = getPomodoroColorForRemainingSeconds(
        remainingSecondsValue,
        WORK_DURATION_SECONDS
      );
      setPomodoros((previousPomodoros) =>
        previousPomodoros.map((pomodoro) =>
          pomodoro.id === cycleIndex ? { ...pomodoro, color } : pomodoro
        )
      );
    },
    []
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
    if (currentStatus === "idle" || currentStatus === "paused") {
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
      Math.ceil(remainingMilliseconds / 1000)
    );
    const cycleIndex = cycleCountRef.current;

    if (remainingMilliseconds > 0) {
      setRemainingSeconds(nextRemainingSeconds);
      remainingSecondsRef.current = nextRemainingSeconds;

      if (nextRemainingSeconds > LOW_ALARM_THRESHOLD_SECONDS) {
        lastLowAlarmSecondRef.current = null;
      } else if (nextRemainingSeconds <= 3) {
        if (lastLowAlarmSecondRef.current !== nextRemainingSeconds) {
          playAlarm(lowAlarmRef);
          lastLowAlarmSecondRef.current = nextRemainingSeconds;
        }
      }

      if (currentStatus === "work") {
        updatePomodoroColor(cycleIndex, nextRemainingSeconds);
      }

      return;
    }

    playAlarm(alarmRef);
    endTimeRef.current = null;

    if (currentStatus === "break") {
      addPomodoro(cycleIndex);
    } else if (currentStatus === "work") {
      updatePomodoroColor(cycleIndex, 0);
    }

    if (currentStatus === "work") {
      const nextCycleCount = cycleIndex + 1;
      setCycleCount(nextCycleCount);
      cycleCountRef.current = nextCycleCount;
      setStatus("break");
      const isLongBreak = nextCycleCount % MAX_CYCLE_COUNT === 0;
      const nextSeconds = isLongBreak
        ? LONG_BREAK_DURATION_SECONDS
        : SHORT_BREAK_DURATION_SECONDS;
      setRemainingSeconds(nextSeconds);
      remainingSecondsRef.current = nextSeconds;
      endTimeRef.current = performance.now() + nextSeconds * 1000;
      lastLowAlarmSecondRef.current = null;
    } else {
      setStatus("work");
      setRemainingSeconds(WORK_DURATION_SECONDS);
      remainingSecondsRef.current = WORK_DURATION_SECONDS;
      endTimeRef.current = performance.now() + WORK_DURATION_SECONDS * 1000;
      lastLowAlarmSecondRef.current = null;
    }
  }, [addPomodoro, updatePomodoroColor]);

  useEffect(() => {
    const isRunning = status === "work" || status === "break";
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

  const handleStart = () => {
    if (status !== "idle") {
      return;
    }
    setStatus("work");
    setRemainingSeconds(WORK_DURATION_SECONDS);
    remainingSecondsRef.current = WORK_DURATION_SECONDS;
    endTimeRef.current = performance.now() + WORK_DURATION_SECONDS * 1000;
    lastLowAlarmSecondRef.current = null;
    addPomodoro(cycleCountRef.current);
  };

  const handlePause = () => {
    if (status === "work" || status === "break") {
      pausedStatusRef.current = status;
      setStatus("paused");
      endTimeRef.current = null;
    }
  };

  const handleResume = () => {
    if (status === "paused") {
      setStatus(pausedStatusRef.current);
      endTimeRef.current =
        performance.now() + remainingSecondsRef.current * 1000;
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
    pausedStatusRef.current = "work";
    setPomodoros([]);
    setStatus("idle");
    endTimeRef.current = null;
    lastLowAlarmSecondRef.current = null;
  };

  const statusText = (() => {
    if (status === "idle") {
      return "Ready";
    }
    if (status === "paused") {
      return "Paused";
    }
    if (status === "work") {
      return "Work";
    }
    if (status === "break") {
      return cycleCount % MAX_CYCLE_COUNT === 0 ? "Long Break" : "Short Break";
    }
    return "";
  })();

  const shouldShowStartButton = status === "idle";
  const shouldShowPauseButton = status === "work" || status === "break";
  const shouldShowResumeButton = status === "paused";
  const shouldShowResetButton = status !== "idle";

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
