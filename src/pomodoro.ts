import {
  POMODORO_TIMER_STATUS,
  WORK_DURATION_SECONDS,
  type PomodoroTimerSchedulerState,
} from "./PomodoroScheduler";

const POMODORO_COLOR_RANGE = {
  redStart: 64,
  redEnd: 255,
  greenStart: 128,
  greenEnd: 32,
  blueValue: 0,
} as const;
const SECONDS_PER_MINUTE = 60;

export const formatSecondsAsClock = (totalSeconds: number) => {
  const minutes = Math.floor(totalSeconds / SECONDS_PER_MINUTE);
  const seconds = totalSeconds % SECONDS_PER_MINUTE;
  return `${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
};

export const getPomodoroColorForRemainingSeconds = (
  remainingSeconds: number,
  workDurationSeconds: number,
) => {
  const progress = workDurationSeconds > 0 ? 1 - remainingSeconds / workDurationSeconds : 1;
  const ratio = Math.min(1, Math.max(0, progress));
  const redValue = Math.floor(
    POMODORO_COLOR_RANGE.redStart +
      (POMODORO_COLOR_RANGE.redEnd - POMODORO_COLOR_RANGE.redStart) * ratio,
  );
  const greenValue = Math.floor(
    POMODORO_COLOR_RANGE.greenStart +
      (POMODORO_COLOR_RANGE.greenEnd - POMODORO_COLOR_RANGE.greenStart) * ratio,
  );

  return `rgb(${redValue}, ${greenValue}, ${POMODORO_COLOR_RANGE.blueValue})`;
};

type Pomodoro = {
  id: number;
  color: string;
};

export const resolvePomodoros = (state: PomodoroTimerSchedulerState): Pomodoro[] => {
  if (state.phase === POMODORO_TIMER_STATUS.IDLE) {
    return [];
  }

  const completedColor = getPomodoroColorForRemainingSeconds(0, WORK_DURATION_SECONDS);
  const pomodoros = Array.from({ length: state.cycleCount }, (_, id) => ({
    id,
    color: completedColor,
  }));

  if (state.phase === POMODORO_TIMER_STATUS.WORK) {
    pomodoros.push({
      id: state.cycleCount,
      color: getPomodoroColorForRemainingSeconds(state.remainingSeconds, WORK_DURATION_SECONDS),
    });
  }

  return pomodoros;
};
