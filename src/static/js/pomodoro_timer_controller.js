export class PomodoroTimerController {
  #model;
  #ui;
  #pubsub;

  constructor(model, ui, pubsub) {
    this.#model = model;
    this.#ui = ui;
    this.#pubsub = pubsub;
  }

  initialize() {
    const eventMappings = {
      "timer-start": this.#handleStart.bind(this),
      "timer-paused": this.#handlePause.bind(this),
      "timer-resumed": this.#handleResume.bind(this),
      "timer-reset": this.#handleReset.bind(this),
      "timer-tick": this.#handleTick.bind(this),
      "timer-finished": this.#handleFinish.bind(this),
    };
    for (const [eventName, handler] of Object.entries(eventMappings)) {
      this.#pubsub.subscribe(eventName, handler);
    }

    const uiEventListeners = {
      onStart: this.#startTimer.bind(this),
      onPause: this.#pauseTimer.bind(this),
      onResume: this.#resumeTimer.bind(this),
      onReset: this.#resetTimer.bind(this),
    };
    this.#ui.addEventListeners(uiEventListeners);
  }

  #startTimer() {
    this.#model.startTimer();

    this.#ui.enablePauseAndResetButtons();
  }

  #pauseTimer() {
    this.#model.pauseTimer();

    this.#ui.enableResumeButton();
  }

  #resumeTimer() {
    this.#model.resumeTimer();

    this.#ui.enablePauseButton();
  }

  #resetTimer() {
    this.#model.resetTimer();

    this.#ui.enableStartButtonOnly();
  }

  #updateRemainingTime(timerStatus) {
    const SECONDS_IN_A_MINUTE = 60;
    const minutes = Math.floor(timerStatus.remainingTime / SECONDS_IN_A_MINUTE);
    const seconds = timerStatus.remainingTime % SECONDS_IN_A_MINUTE;
    this.#ui.updateRemainingTime(minutes, seconds);
  }

  #handleStart(timerStatus) {
    this.#updateRemainingTime(timerStatus);

    this.#ui.updateStatus(timerStatus);

    this.#ui.addPomodoro(timerStatus);
  }

  #handlePause(timerStatus) {
    this.#ui.updateStatus(timerStatus);

    this.#ui.enableResumeButton();
  }

  #handleResume(timerStatus) {
    this.#ui.updateStatus(timerStatus);

    this.#ui.enablePauseButton();
  }

  #handleReset(timerStatus) {
    this.#updateRemainingTime(timerStatus);

    this.#ui.updateStatus(timerStatus);

    this.#ui.enableStartButtonOnly();

    this.#ui.clearPomodori();
  }

  #handleTick(timerStatus) {
    this.#updateRemainingTime(timerStatus);

    this.#ui.updateStatus(timerStatus);

    const LOW_ALARM_THRESHOLD = 3;
    if (timerStatus.remainingTime <= LOW_ALARM_THRESHOLD) {
      this.#ui.playLowAlarm();
    }

    if (timerStatus.isWorkTime) {
      this.#ui.ripenPomodoro(timerStatus);
    }
  }

  #handleFinish(timerStatus) {
    this.#updateRemainingTime(timerStatus);

    this.#ui.updateStatus(timerStatus);

    this.#ui.playAlarm();

    if (timerStatus.isBreak) {
      this.#ui.addPomodoro(timerStatus);
    } else {
      this.#ui.ripenPomodoro(timerStatus);
    }
  }
}
