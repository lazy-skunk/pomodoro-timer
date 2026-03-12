import {
  POMODORO_TIMER_STATUS,
  type PomodoroTimerSchedulerState,
} from "../schedulers/PomodoroTimerScheduler";

export const formatSecondsAsClock = (totalSeconds: number) => {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes.toString().padStart(2, "0")}:${seconds
    .toString()
    .padStart(2, "0")}`;
};

export const getPomodoroColorForRemainingSeconds = (
  remainingSeconds: number,
  workDurationSeconds: number,
) => {
  const colorRange = {
    redStart: 64,
    redEnd: 255,
    greenStart: 128,
    greenEnd: 32,
    blueValue: 0,
  };

  const ratio = 1 - remainingSeconds / workDurationSeconds;
  const redValue = Math.floor(
    colorRange.redStart + (colorRange.redEnd - colorRange.redStart) * ratio,
  );
  const greenValue = Math.floor(
    colorRange.greenStart +
      (colorRange.greenEnd - colorRange.greenStart) * ratio,
  );

  return `rgb(${redValue}, ${greenValue}, ${colorRange.blueValue})`;
};

export type Pomodoro = {
  id: number;
  color: string;
};

export const resolveNextPomodoros = (
  pomodoros: Pomodoro[],
  previousState: PomodoroTimerSchedulerState,
  nextState: PomodoroTimerSchedulerState,
  basePomodoroColor: string,
  workDurationSeconds: number,
) => {
  let nextPomodoros = pomodoros;

  const addPomodoro = (cycleIndex: number, color: string) => {
    if (nextPomodoros.some((pomodoro) => pomodoro.id === cycleIndex)) {
      return;
    }

    nextPomodoros = [...nextPomodoros, { id: cycleIndex, color }];
  };

  const updatePomodoroColor = (
    cycleIndex: number,
    remainingSeconds: number,
  ) => {
    const color = getPomodoroColorForRemainingSeconds(
      remainingSeconds,
      workDurationSeconds,
    );

    nextPomodoros = nextPomodoros.map((pomodoro) =>
      pomodoro.id === cycleIndex ? { ...pomodoro, color } : pomodoro,
    );
  };

  const previousPhase = previousState.phase;
  const nextPhase = nextState.phase;
  const previousRunningPhase = previousState.isPaused ? null : previousPhase;
  const nextRunningPhase = nextState.isPaused ? null : nextPhase;

  if (
    previousPhase === POMODORO_TIMER_STATUS.IDLE &&
    nextPhase === POMODORO_TIMER_STATUS.WORK
  ) {
    addPomodoro(nextState.cycleCount, basePomodoroColor);
  }

  if (
    previousRunningPhase !== POMODORO_TIMER_STATUS.WORK &&
    previousPhase !== POMODORO_TIMER_STATUS.IDLE &&
    nextRunningPhase === POMODORO_TIMER_STATUS.WORK
  ) {
    addPomodoro(previousState.cycleCount, basePomodoroColor);
  }

  if (nextRunningPhase === POMODORO_TIMER_STATUS.WORK) {
    updatePomodoroColor(nextState.cycleCount, nextState.remainingSeconds);
  }

  if (
    previousRunningPhase === POMODORO_TIMER_STATUS.WORK &&
    (nextRunningPhase === POMODORO_TIMER_STATUS.SHORT_BREAK ||
      nextRunningPhase === POMODORO_TIMER_STATUS.LONG_BREAK) &&
    nextPhase !== POMODORO_TIMER_STATUS.IDLE
  ) {
    updatePomodoroColor(previousState.cycleCount, 0);
  }

  return nextPomodoros;
};
