import { formatSecondsAsClock, resolvePomodoros } from "./pomodoro";
import { POMODORO_TIMER_STATUS, type PomodoroTimerPhase } from "./PomodoroScheduler";
import { usePomodoroTimer } from "./usePomodoroTimer";

const statusTextByPhase = {
  [POMODORO_TIMER_STATUS.IDLE]: "Ready",
  [POMODORO_TIMER_STATUS.WORK]: "Work",
  [POMODORO_TIMER_STATUS.LONG_BREAK]: "Long Break",
  [POMODORO_TIMER_STATUS.SHORT_BREAK]: "Short Break",
} satisfies Record<PomodoroTimerPhase, string>;

const baseButtonClass =
  "cursor-pointer rounded px-4 py-2 text-sm font-medium motion-safe:transition motion-safe:active:translate-y-px";
const startButtonClass = `${baseButtonClass} bg-green-100 text-green-900 dark:bg-green-900 dark:text-green-100`;
const pauseButtonClass = `${baseButtonClass} bg-yellow-100 text-yellow-900 dark:bg-yellow-900 dark:text-yellow-100`;
const resetButtonClass = `${baseButtonClass} bg-red-100 text-red-900 dark:bg-red-900 dark:text-red-100`;

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
    <div className="bg-background text-foreground flex min-h-screen flex-col items-center justify-center gap-5 p-3 text-center">
      <header>
        <h1 className="text-3xl font-bold">
          <a href="#">Pomodoro Timer</a>
        </h1>
      </header>

      <main className="flex flex-col items-center gap-5">
        <div className="text-6xl font-bold">
          {formatSecondsAsClock(timerState.remainingSeconds)}
        </div>

        <div className="text-xl">{statusText}</div>

        {errorMessage && <div className="text-sm text-red-500">{errorMessage}</div>}

        <div className="flex flex-wrap items-center justify-center gap-2">
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

        {pomodoros.length > 0 && (
          <>
            <div className="flex max-w-3xl flex-wrap justify-center">
              {pomodoros.map((pomodoro) => (
                <div
                  key={pomodoro.id}
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
            <div>
              {pomodoros.length} pomodoro{pomodoros.length > 1 ? "s" : ""}
            </div>
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
