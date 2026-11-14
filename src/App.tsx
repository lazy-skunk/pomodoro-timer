import { Pomodoro } from "./Pomodoro";
import { POMODORO_TIMER_STATUS, type PomodoroTimerPhase } from "./PomodoroScheduler";
import { formatSecondsAsClock, resolvePomodoros } from "./pomodoroUtils";
import { usePomodoroTimer } from "./usePomodoroTimer";

const statusTextByPhase = {
  [POMODORO_TIMER_STATUS.IDLE]: "Ready",
  [POMODORO_TIMER_STATUS.WORK]: "Work",
  [POMODORO_TIMER_STATUS.LONG_BREAK]: "Long Break",
  [POMODORO_TIMER_STATUS.SHORT_BREAK]: "Short Break",
} satisfies Record<PomodoroTimerPhase, string>;

const baseButtonClasses =
  "cursor-pointer rounded px-4 py-2 motion-safe:transition motion-safe:active:translate-y-px";

export function App() {
  const {
    timerState,
    errorMessage,
    canStart,
    canPause,
    canResume,
    canReset,
    startTimer,
    pauseTimer,
    resumeTimer,
    resetTimer,
  } = usePomodoroTimer();

  const pomodoros = resolvePomodoros(timerState);
  const statusText = resolveStatusText(timerState.phase, timerState.isPaused);

  return (
    <div className="bg-background text-foreground flex min-h-screen flex-col items-center justify-center gap-6 p-6 text-center">
      <header>
        <h1 className="text-lg font-bold">
          <a href="#">Pomodoro Timer</a>
        </h1>
      </header>

      <main className="flex flex-col items-center gap-4">
        <div className="grid gap-2">
          <div className="text-9xl font-bold tabular-nums">
            {formatSecondsAsClock(timerState.remainingSeconds)}
          </div>
          <p className="font-semibold">{statusText}</p>
          <div role="alert" className="empty:absolute">
            {errorMessage && (
              <p className="text-red-500 motion-safe:transition-opacity motion-safe:starting:opacity-0">
                {errorMessage}
              </p>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-2">
          {canStart && (
            <button
              type="button"
              onClick={() => {
                void startTimer();
              }}
              className={`${baseButtonClasses} bg-green-100 text-green-900 dark:bg-green-900 dark:text-green-100`}
            >
              Start
            </button>
          )}
          {canPause && (
            <button
              type="button"
              onClick={pauseTimer}
              className={`${baseButtonClasses} bg-blue-100 text-blue-900 dark:bg-blue-900 dark:text-blue-100`}
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
              className={`${baseButtonClasses} bg-green-100 text-green-900 dark:bg-green-900 dark:text-green-100`}
            >
              Resume
            </button>
          )}
          {canReset && (
            <button
              type="button"
              onClick={resetTimer}
              className={`${baseButtonClasses} bg-red-100 text-red-900 dark:bg-red-900 dark:text-red-100`}
            >
              Reset
            </button>
          )}
        </div>

        {pomodoros.length > 0 && (
          <>
            <div className="flex max-w-3xl flex-wrap justify-center gap-x-2 gap-y-4">
              {pomodoros.map((pomodoro) => (
                <Pomodoro key={pomodoro.id} color={pomodoro.color} />
              ))}
            </div>
            <p role="status">
              {pomodoros.length} pomodoro{pomodoros.length > 1 ? "s" : ""}
            </p>
          </>
        )}
      </main>
    </div>
  );
}

const resolveStatusText = (phase: PomodoroTimerPhase, isPaused: boolean) => {
  const statusText = statusTextByPhase[phase];
  return isPaused && phase !== POMODORO_TIMER_STATUS.IDLE ? `Paused (${statusText})` : statusText;
};
