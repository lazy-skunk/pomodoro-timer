export class PomodoroTimerModel {
  #workDuration;
  #shortBreakDuration;
  #longBreakDuration;
  #MAX_CYCLES;

  #pubsub;

  #timer;
  #remainingTime;
  #currentCycles;
  #status;

  constructor(config, pubsub) {
    this.#workDuration = config.workDuration;
    this.#shortBreakDuration = config.shortBreakDuration;
    this.#longBreakDuration = config.longBreakDuration;
    this.#MAX_CYCLES = 4;

    this.#pubsub = pubsub;

    this.#timer = null;
    this.#remainingTime = this.#workDuration;
    this.#currentCycles = 0;
    this.#status = {
      isWorkTime: false,
      isBreak: false,
      isPaused: false,
      isReset: false,
    };
  }

  startTimer() {
    this.#status.isWorkTime = true;
    this.#status.isReset = false;

    this.#pubsub.publish("timer-start", this.#getStatus());

    this.#timer = setInterval(() => this.#tick(), 1000);
  }

  pauseTimer() {
    clearInterval(this.#timer);
    this.#timer = null;

    this.#status.isPaused = true;

    this.#pubsub.publish("timer-paused", this.#getStatus());
  }

  resumeTimer() {
    this.#status.isPaused = false;

    this.#pubsub.publish("timer-resumed", this.#getStatus());

    this.#timer = setInterval(() => this.#tick(), 1000);
  }

  resetTimer() {
    clearInterval(this.#timer);
    this.#timer = null;
    this.#remainingTime = this.#workDuration;
    this.#currentCycles = 0;

    this.#status.isWorkTime = false;
    this.#status.isPaused = false;
    this.#status.isBreak = false;
    this.#status.isReset = true;

    this.#pubsub.publish("timer-reset", this.#getStatus());
  }

  #tick() {
    this.#remainingTime--;
    if (this.#remainingTime > 0) {
      this.#pubsub.publish("timer-tick", this.#getStatus());
    } else {
      this.#timerFinished();
    }
  }

  #timerFinished() {
    this.#pubsub.publish("timer-finished", this.#getStatus());

    if (this.#status.isWorkTime) {
      this.#currentCycles++;
      this.#status.isWorkTime = false;
      this.#status.isBreak = true;
      if (this.#currentCycles % this.#MAX_CYCLES === 0) {
        this.#remainingTime = this.#longBreakDuration;
      } else {
        this.#remainingTime = this.#shortBreakDuration;
      }
    } else {
      this.#status.isWorkTime = true;
      this.#status.isBreak = false;
      this.#remainingTime = this.#workDuration;
    }
  }

  #getStatus() {
    return {
      workDuration: this.#workDuration,
      remainingTime: this.#remainingTime,
      currentCycles: this.#currentCycles,
      maxCycles: this.#MAX_CYCLES,
      ...this.#status,
    };
  }
}
