"use client";

import { usePomodoroTimer } from "../hooks/usePomodoroTimer";
import { POMODORO_TIMER_STATUS, type PomodoroTimerPhase } from "../lib/scheduler";
import { formatSecondsAsClock } from "../lib/pomodoro";

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
    "inline-flex min-w-32 items-center justify-center rounded-full px-6 py-3 text-xl font-bold shadow-sm transition-transform active:scale-95";
  const startButtonClass = `${baseButtonClass} bg-emerald-600 text-zinc-900 hover:bg-emerald-500`;
  const pauseButtonClass = `${baseButtonClass} bg-amber-600 text-zinc-900 hover:bg-amber-500`;
  const resetButtonClass = `${baseButtonClass} bg-rose-600 text-zinc-900 hover:bg-rose-500`;
  const statusText = resolveStatusText(timerState.phase, timerState.isPaused);

  return (
    <div className="flex min-h-screen flex-col items-center p-5 text-center">
      <h1 className="text-3xl font-bold text-zinc-100">Keep incremental improvements!</h1>

      <div className="mt-6 text-6xl font-black text-zinc-50">
        {formatSecondsAsClock(timerState.remainingSeconds)}
      </div>

      <div className="mt-3 text-xl font-medium text-zinc-300">{statusText}</div>

      {errorMessage && (
        <div className="mt-3 max-w-md rounded-2xl border border-rose-400/30 bg-rose-950/60 px-4 py-3 text-sm font-medium text-rose-100">
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
          <button type="button" onClick={pauseTimer} className={pauseButtonClass}>
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
          <button type="button" onClick={resetTimer} className={resetButtonClass}>
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
        <div className="mt-4 text-zinc-300">
          {pomodoros.length} pomodoro{pomodoros.length > 1 ? "s" : ""}
        </div>
      )}
    </div>
  );
}

const resolveStatusText = (phase: PomodoroTimerPhase, isPaused: boolean) => {
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
