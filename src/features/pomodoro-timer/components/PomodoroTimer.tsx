"use client";

import { usePomodoroTimer } from "../hooks/usePomodoroTimer";
import { formatSecondsAsClock } from "../utils/pomodoro";

export default function PomodoroTimer() {
  const {
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
  } = usePomodoroTimer();

  const baseButtonClass =
    "inline-flex min-w-32 items-center justify-center rounded-full px-6 py-3 text-background text-lg font-semibold shadow-sm transition-transform active:scale-95";
  const startButtonClass = `${baseButtonClass} bg-emerald-500 hover:bg-emerald-600`;
  const pauseButtonClass = `${baseButtonClass} bg-amber-500 hover:bg-amber-600`;
  const resetButtonClass = `${baseButtonClass} bg-rose-500 hover:bg-rose-600`;

  return (
    <div className="p-5 flex flex-col items-center text-center">
      <h1 className="text-3xl font-bold">Keep incremental improvements!</h1>

      <div className="mt-6 text-6xl font-black">
        {formatSecondsAsClock(remainingSeconds)}
      </div>

      <div className="mt-3 text-xl font-medium">{statusText}</div>

      <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
        {shouldShowStartButton && (
          <button
            type="button"
            onClick={handleStart}
            className={startButtonClass}
          >
            Start
          </button>
        )}
        {shouldShowPauseButton && (
          <button
            type="button"
            onClick={handlePause}
            className={pauseButtonClass}
          >
            Pause
          </button>
        )}
        {shouldShowResumeButton && (
          <button
            type="button"
            onClick={handleResume}
            className={startButtonClass}
          >
            Resume
          </button>
        )}
        {shouldShowResetButton && (
          <button
            type="button"
            onClick={handleReset}
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
          {pomodoros.length} pomodoro{pomodoros.length === 1 ? "" : "s"}
        </div>
      )}
    </div>
  );
}
