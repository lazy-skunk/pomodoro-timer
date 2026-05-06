import { POMODORO_TIMER_STATUS } from "@/features/pomodoro-timer/services/schedulers/PomodoroTimerScheduler";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";

const startTimer = jest.fn(async () => true);
const pauseTimer = jest.fn();
const resumeTimer = jest.fn(async () => true);
const resetTimer = jest.fn();

const usePomodoroTimerMock = jest.fn();

jest.mock("@/features/pomodoro-timer/hooks/usePomodoroTimer", () => ({
  usePomodoroTimer: (...args: unknown[]) => usePomodoroTimerMock(...args),
}));

import PomodoroTimer from "@/features/pomodoro-timer/components/PomodoroTimer";

describe("PomodoroTimer", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    globalThis.IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    startTimer.mockClear();
    pauseTimer.mockClear();
    resumeTimer.mockClear();
    resetTimer.mockClear();
    usePomodoroTimerMock.mockReset();
  });

  afterEach(async () => {
    await act(async () => {
      root.unmount();
    });
    container.remove();
  });

  it("renders the idle state with a start button", async () => {
    usePomodoroTimerMock.mockReturnValue({
      timerState: {
        remainingSeconds: 1500,
        cycleCount: 0,
        phase: POMODORO_TIMER_STATUS.IDLE,
        isPaused: false,
      },
      pomodoros: [],
      errorMessage: null,
      canStart: true,
      canPause: false,
      canResume: false,
      canReset: false,
      startTimer,
      pauseTimer,
      resumeTimer,
      resetTimer,
    });

    await act(async () => {
      root.render(<PomodoroTimer />);
    });

    expect(container.textContent).toContain("25:00");
    expect(container.textContent).toContain("Ready");
    expect(container.textContent).toContain("Start");
  });

  it("renders active pomodoros and calls button handlers", async () => {
    usePomodoroTimerMock.mockReturnValue({
      timerState: {
        remainingSeconds: 1200,
        cycleCount: 1,
        phase: POMODORO_TIMER_STATUS.WORK,
        isPaused: false,
      },
      pomodoros: [
        { id: 0, color: "rgb(255, 32, 0)" },
        { id: 1, color: "rgb(64, 128, 0)" },
      ],
      errorMessage: "Clock error",
      canStart: false,
      canPause: true,
      canResume: false,
      canReset: true,
      startTimer,
      pauseTimer,
      resumeTimer,
      resetTimer,
    });

    await act(async () => {
      root.render(<PomodoroTimer />);
    });

    expect(container.textContent).toContain("20:00");
    expect(container.textContent).toContain("Work");
    expect(container.textContent).toContain("Clock error");
    expect(container.textContent).toContain("2 pomodoros");
    expect(container.querySelectorAll(".pomodoro")).toHaveLength(2);

    const pauseButton = Array.from(container.querySelectorAll("button")).find(
      (button) => button.textContent === "Pause",
    );
    const resetButton = Array.from(container.querySelectorAll("button")).find(
      (button) => button.textContent === "Reset",
    );

    expect(pauseButton).toBeTruthy();
    expect(resetButton).toBeTruthy();

    act(() => {
      pauseButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      resetButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(pauseTimer).toHaveBeenCalledTimes(1);
    expect(resetTimer).toHaveBeenCalledTimes(1);
  });

  it("renders the paused status and resume action", async () => {
    usePomodoroTimerMock.mockReturnValue({
      timerState: {
        remainingSeconds: 300,
        cycleCount: 1,
        phase: POMODORO_TIMER_STATUS.SHORT_BREAK,
        isPaused: true,
      },
      pomodoros: [{ id: 0, color: "rgb(255, 32, 0)" }],
      errorMessage: null,
      canStart: false,
      canPause: false,
      canResume: true,
      canReset: true,
      startTimer,
      pauseTimer,
      resumeTimer,
      resetTimer,
    });

    await act(async () => {
      root.render(<PomodoroTimer />);
    });

    expect(container.textContent).toContain("05:00");
    expect(container.textContent).toContain("Paused (Short Break)");
    expect(container.textContent).toContain("Resume");

    const resumeButton = Array.from(container.querySelectorAll("button")).find(
      (button) => button.textContent === "Resume",
    );

    act(() => {
      resumeButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(resumeTimer).toHaveBeenCalledTimes(1);
  });
});
