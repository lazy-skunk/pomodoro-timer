"use client";

import { usePomodoroTimer } from "../hooks/usePomodoroTimer";
import {
  POMODORO_TIMER_STATUS,
  type PomodoroTimerPhase,
} from "../schedulers/PomodoroTimerScheduler";
import { formatSecondsAsClock } from "../utils/pomodoro";

const STATUS_TEXT = {
  READY: "Ready",
  PAUSED_WORK: "Paused (Work)",
  PAUSED_LONG_BREAK: "Paused (Long Break)",
  PAUSED_SHORT_BREAK: "Paused (Short Break)",
  WORK: "Work",
  LONG_BREAK: "Long Break",
  SHORT_BREAK: "Short Break",
} as const;

export default function PomodoroTimer() {
  const basePomodoroColor = "rgb(64, 128, 0)";
  const {
    timerState,
    pomodoros,
    errorMessage,
    canStart,
    canPause,
    canResume,
    canReset,
    startTimer,
    pauseTimer,
    resumeTimer,
    resetTimer,
  } = usePomodoroTimer({ basePomodoroColor });

  const baseButtonClass =
    "inline-flex min-w-32 items-center justify-center rounded-full px-6 py-3 text-background text-lg font-semibold shadow-sm transition-transform active:scale-95";
  const startButtonClass = `${baseButtonClass} bg-emerald-500 hover:bg-emerald-600`;
  const pauseButtonClass = `${baseButtonClass} bg-amber-500 hover:bg-amber-600`;
  const resetButtonClass = `${baseButtonClass} bg-rose-500 hover:bg-rose-600`;
  const statusText = resolveStatusText(timerState.phase, timerState.isPaused);

  return (
    <div className="p-5 flex flex-col items-center text-center">
      <h1 className="text-3xl font-bold">Keep incremental improvements!</h1>

      <div className="mt-6 text-6xl font-black">
        {formatSecondsAsClock(timerState.remainingSeconds)}
      </div>

      <div className="mt-3 text-xl font-medium">
        {statusText}
      </div>

      {errorMessage && (
        <div className="mt-3 max-w-md rounded-2xl bg-rose-100 px-4 py-3 text-sm font-medium text-rose-700">
          {errorMessage}
        </div>
      )}

      <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
        {canStart && (
          <button
            type="button"
            onClick={() => {
              void startTimer();
            }}
            className={startButtonClass}
          >
            Start
          </button>
        )}
        {canPause && (
          <button
            type="button"
            onClick={pauseTimer}
            className={pauseButtonClass}
          >
            Pause
          </button>
        )}
        {canResume && (
          <button
            type="button"
            onClick={() => {
              void resumeTimer();
            }}
            className={startButtonClass}
          >
            Resume
          </button>
        )}
        {canReset && (
          <button
            type="button"
            onClick={resetTimer}
            className={resetButtonClass}
          >
            Reset
          </button>
        )}
      </div>

      <div className="mt-6 mx-auto max-w-3xl flex flex-wrap items-center justify-center">
        {pomodoros.map((pomodoro) => (
          <div
            key={pomodoro.id}
            id={`pomodoro-${pomodoro.id}`}
            className="pomodoro"
            style={{ backgroundColor: pomodoro.color }}
          >
            <div className="stem-leaf" />
            <div className="stem-leaf leaf-1" />
            <div className="stem-leaf leaf-2" />
            <div className="stem-leaf leaf-3" />
            <div className="stem-leaf leaf-4" />
            <div className="stem-leaf leaf-5" />
          </div>
        ))}
      </div>

      {pomodoros.length > 0 && (
        <div className="mt-4">
          {pomodoros.length} pomodoro{pomodoros.length > 1 ? "s" : ""}
        </div>
      )}
    </div>
  );
}

const resolveStatusText = (
  phase: PomodoroTimerPhase,
  isPaused: boolean,
) => {
  if (phase === POMODORO_TIMER_STATUS.IDLE) {
    return STATUS_TEXT.READY;
  }
  if (isPaused) {
    if (phase === POMODORO_TIMER_STATUS.WORK) {
      return STATUS_TEXT.PAUSED_WORK;
    }
    if (phase === POMODORO_TIMER_STATUS.LONG_BREAK) {
      return STATUS_TEXT.PAUSED_LONG_BREAK;
    }
    if (phase === POMODORO_TIMER_STATUS.SHORT_BREAK) {
      return STATUS_TEXT.PAUSED_SHORT_BREAK;
    }
  }
  if (phase === POMODORO_TIMER_STATUS.WORK) {
    return STATUS_TEXT.WORK;
  }
  if (phase === POMODORO_TIMER_STATUS.LONG_BREAK) {
    return STATUS_TEXT.LONG_BREAK;
  }
  if (phase === POMODORO_TIMER_STATUS.SHORT_BREAK) {
    return STATUS_TEXT.SHORT_BREAK;
  }
  return "";
};
