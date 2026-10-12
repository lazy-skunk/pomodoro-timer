const SECONDS_PER_MINUTE = 60;
const MILLISECONDS_PER_SECOND = 1000;

export const WORK_DURATION_SECONDS = SECONDS_PER_MINUTE * 25;
export const SHORT_BREAK_DURATION_SECONDS = SECONDS_PER_MINUTE * 5;
export const LONG_BREAK_DURATION_SECONDS = SECONDS_PER_MINUTE * 15;

const MAX_CYCLE_COUNT = 4;

export const POMODORO_TIMER_STATUS = {
  IDLE: "idle",
  WORK: "work",
  SHORT_BREAK: "shortBreak",
  LONG_BREAK: "longBreak",
} as const;

export type PomodoroTimerPhase = (typeof POMODORO_TIMER_STATUS)[keyof typeof POMODORO_TIMER_STATUS];

export type PomodoroTimerSchedulerState = {
  readonly remainingSeconds: number;
  readonly cycleCount: number;
  readonly phase: PomodoroTimerPhase;
  readonly isPaused: boolean;
};

type PomodoroTimerSchedulerClock = {
  prepare: () => Promise<number>;
  getCurrentTimeSeconds: () => number | null;
};

type PomodoroTimerSchedulerOptions = {
  clock: PomodoroTimerSchedulerClock;
  onStateChanged?: (state: PomodoroTimerSchedulerState) => void;
  onClockUnavailable?: () => void;
  onPhaseStarted?: (phaseStartTimeSeconds: number, durationSeconds: number) => void;
};

const TICK_INTERVAL_MILLISECONDS = MILLISECONDS_PER_SECOND;

export class PomodoroTimerScheduler {
  private tickerIntervalId: ReturnType<typeof setInterval> | null = null;
  private isPreparingClock = false;
  private prepareRequestId = 0;

  private readonly clock: PomodoroTimerSchedulerClock;
  private readonly onStateChanged?: (state: PomodoroTimerSchedulerState) => void;
  private readonly onClockUnavailable?: () => void;
  private readonly onPhaseStarted?: (
    phaseStartTimeSeconds: number,
    durationSeconds: number,
  ) => void;

  private state: PomodoroTimerSchedulerState = {
    remainingSeconds: WORK_DURATION_SECONDS,
    cycleCount: 0,
    phase: POMODORO_TIMER_STATUS.IDLE,
    isPaused: false,
  };
  private endTimeSeconds: number | null = null;
  private pausedRemainingDurationSeconds = 0;

  constructor(options: PomodoroTimerSchedulerOptions) {
    this.clock = options.clock;
    this.onStateChanged = options.onStateChanged;
    this.onClockUnavailable = options.onClockUnavailable;
    this.onPhaseStarted = options.onPhaseStarted;
  }

  public getState() {
    return this.state;
  }

  public async start() {
    if (this.state.phase !== POMODORO_TIMER_STATUS.IDLE || this.isPreparingClock) {
      return false;
    }

    this.isPreparingClock = true;
    const requestId = ++this.prepareRequestId;

    try {
      const currentTimeSeconds = await this.clock.prepare();

      if (requestId !== this.prepareRequestId || this.state.phase !== POMODORO_TIMER_STATUS.IDLE) {
        return false;
      }

      this.state = {
        remainingSeconds: WORK_DURATION_SECONDS,
        cycleCount: 0,
        phase: POMODORO_TIMER_STATUS.WORK,
        isPaused: false,
      };
      this.startPhase(currentTimeSeconds, WORK_DURATION_SECONDS);
      this.notifyStateChanged();
      return true;
    } finally {
      if (requestId === this.prepareRequestId) {
        this.isPreparingClock = false;
      }
    }
  }

  public pause() {
    if (this.state.phase === POMODORO_TIMER_STATUS.IDLE || this.state.isPaused) {
      return;
    }

    this.stopTicker();
    this.pausedRemainingDurationSeconds = this.resolveRemainingDurationSeconds();
    this.endTimeSeconds = null;
    this.state = {
      ...this.state,
      remainingSeconds: Math.ceil(this.pausedRemainingDurationSeconds),
      isPaused: true,
    };
    this.notifyStateChanged();
  }

  public async resume() {
    if (!this.state.isPaused || this.isPreparingClock) {
      return false;
    }

    this.isPreparingClock = true;
    const requestId = ++this.prepareRequestId;

    try {
      const currentTimeSeconds = await this.clock.prepare();

      if (requestId !== this.prepareRequestId || !this.state.isPaused) {
        return false;
      }

      this.state = {
        ...this.state,
        isPaused: false,
      };
      this.startPhase(currentTimeSeconds, this.pausedRemainingDurationSeconds);
      this.notifyStateChanged();
      return true;
    } finally {
      if (requestId === this.prepareRequestId) {
        this.isPreparingClock = false;
      }
    }
  }

  public reset() {
    this.resetState();
    this.notifyStateChanged();
  }

  private resetState() {
    this.prepareRequestId += 1;
    this.isPreparingClock = false;
    this.stopTicker();
    this.endTimeSeconds = null;
    this.state = {
      remainingSeconds: WORK_DURATION_SECONDS,
      cycleCount: 0,
      phase: POMODORO_TIMER_STATUS.IDLE,
      isPaused: false,
    };
  }

  public dispose() {
    this.resetState();
  }

  private readonly tick = () => {
    if (this.state.phase === POMODORO_TIMER_STATUS.IDLE || this.state.isPaused) {
      return;
    }

    if (!this.endTimeSeconds) {
      return;
    }

    const currentTimeSeconds = this.clock.getCurrentTimeSeconds();
    if (currentTimeSeconds === null) {
      this.resetState();
      this.notifyStateChanged();
      this.onClockUnavailable?.();
      return;
    }

    const remainingMilliseconds =
      (this.endTimeSeconds - currentTimeSeconds) * MILLISECONDS_PER_SECOND;
    const remainingSeconds = Math.max(
      0,
      Math.ceil(remainingMilliseconds / MILLISECONDS_PER_SECOND),
    );

    if (remainingMilliseconds > 0) {
      const previousState = this.state;
      this.state = {
        ...this.state,
        remainingSeconds,
      };
      this.notifyStateChanged(previousState);
      return;
    }

    const transitionTimeSeconds = this.endTimeSeconds;

    if (this.state.phase === POMODORO_TIMER_STATUS.WORK) {
      this.advanceToBreakState(transitionTimeSeconds);
      this.notifyStateChanged();
      return;
    }

    this.advanceToWorkState(transitionTimeSeconds);
    this.notifyStateChanged();
  };

  private advanceToBreakState(phaseStartTimeSeconds: number) {
    const nextCycleCount = this.state.cycleCount + 1;
    const nextBreakPhase = resolveBreakPhase(nextCycleCount);
    const nextRemainingSeconds =
      nextBreakPhase === POMODORO_TIMER_STATUS.LONG_BREAK
        ? LONG_BREAK_DURATION_SECONDS
        : SHORT_BREAK_DURATION_SECONDS;

    this.state = {
      remainingSeconds: nextRemainingSeconds,
      cycleCount: nextCycleCount,
      phase: nextBreakPhase,
      isPaused: false,
    };
    this.startPhase(phaseStartTimeSeconds, nextRemainingSeconds);
  }

  private advanceToWorkState(phaseStartTimeSeconds: number) {
    this.state = {
      ...this.state,
      remainingSeconds: WORK_DURATION_SECONDS,
      phase: POMODORO_TIMER_STATUS.WORK,
      isPaused: false,
    };
    this.startPhase(phaseStartTimeSeconds, WORK_DURATION_SECONDS);
  }

  private startPhase(phaseStartTimeSeconds: number, durationSeconds: number) {
    this.endTimeSeconds = phaseStartTimeSeconds + durationSeconds;
    this.onPhaseStarted?.(phaseStartTimeSeconds, durationSeconds);
    this.startTicker();
  }

  private startTicker() {
    if (this.tickerIntervalId) {
      clearInterval(this.tickerIntervalId);
    }

    this.tickerIntervalId = setInterval(this.tick, TICK_INTERVAL_MILLISECONDS);
  }

  private stopTicker() {
    if (!this.tickerIntervalId) {
      return;
    }

    clearInterval(this.tickerIntervalId);
    this.tickerIntervalId = null;
  }

  private notifyStateChanged(previousState?: PomodoroTimerSchedulerState) {
    if (previousState && areSchedulerStatesEqual(previousState, this.state)) {
      return;
    }

    this.onStateChanged?.(this.state);
  }

  private resolveRemainingDurationSeconds() {
    if (!this.endTimeSeconds) {
      return this.state.remainingSeconds;
    }

    const currentTimeSeconds = this.clock.getCurrentTimeSeconds();
    if (currentTimeSeconds === null) {
      return this.state.remainingSeconds;
    }

    return Math.max(0, this.endTimeSeconds - currentTimeSeconds);
  }
}

const resolveBreakPhase = (cycleCount: number): PomodoroTimerPhase => {
  return cycleCount % MAX_CYCLE_COUNT === 0
    ? POMODORO_TIMER_STATUS.LONG_BREAK
    : POMODORO_TIMER_STATUS.SHORT_BREAK;
};

const areSchedulerStatesEqual = (
  left: PomodoroTimerSchedulerState,
  right: PomodoroTimerSchedulerState,
) => {
  return (
    left.remainingSeconds === right.remainingSeconds &&
    left.cycleCount === right.cycleCount &&
    left.phase === right.phase &&
    left.isPaused === right.isPaused
  );
};
