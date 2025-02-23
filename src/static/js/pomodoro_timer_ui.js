export class PomodoroTimerUI {
  #elements;
  #alarm;
  #lowAlarm;

  constructor(alarm, lowAlarm) {
    this.#elements = this.#getDOMElements();
    this.#alarm = alarm;
    this.#lowAlarm = lowAlarm;
  }

  addEventListeners({ onStart, onPause, onResume, onReset }) {
    this.#elements.startButton.addEventListener("click", onStart);
    this.#elements.pauseButton.addEventListener("click", onPause);
    this.#elements.resumeButton.addEventListener("click", onResume);
    this.#elements.resetButton.addEventListener("click", onReset);
  }

  enablePauseAndResetButtons() {
    this.#toggleButton(this.#elements.startButton, false);
    this.#toggleButton(this.#elements.pauseButton, true);
    this.#toggleButton(this.#elements.resetButton, true);
  }

  enableResumeButton() {
    this.#toggleButton(this.#elements.pauseButton, false);
    this.#toggleButton(this.#elements.resumeButton, true);
  }

  enablePauseButton() {
    this.#toggleButton(this.#elements.pauseButton, true);
    this.#toggleButton(this.#elements.resumeButton, false);
  }

  enableStartButtonOnly() {
    this.#toggleButton(this.#elements.startButton, true);
    this.#toggleButton(this.#elements.pauseButton, false);
    this.#toggleButton(this.#elements.resumeButton, false);
    this.#toggleButton(this.#elements.resetButton, false);
  }

  updateRemainingTime(minutes, seconds) {
    const formattedTime = this.#formatTime(minutes, seconds);
    this.#elements.remainingTime.innerText = formattedTime;
  }

  updateStatus(timerStatus) {
    const { isWorkTime, isPaused, isBreak, isReset, currentCycles, maxCycles } =
      timerStatus;

    if (isReset) {
      this.#elements.statusDisplay.textContent = "Ready";
    } else if (isPaused) {
      this.#elements.statusDisplay.textContent = "Paused";
    } else if (isWorkTime) {
      this.#elements.statusDisplay.textContent = "Work";
    } else {
      if (isBreak) {
        if (currentCycles % maxCycles === 0) {
          this.#elements.statusDisplay.textContent = "Long Break";
        } else {
          this.#elements.statusDisplay.textContent = "Short Break";
        }
      }
    }
  }

  playAlarm() {
    this.#alarm.play();
  }

  playLowAlarm() {
    this.#lowAlarm.play();
  }

  addPomodoro(timerStatus) {
    const { currentCycles } = timerStatus;
    const pomodoroId = `pomodoro-${currentCycles}`;
    const pomodoro = this.#createPomodoro(pomodoroId);

    const stemAndLeavesFragment = this.#createStemAndLeaves();
    pomodoro.appendChild(stemAndLeavesFragment);

    this.#elements.pomodoroContainer.appendChild(pomodoro);
  }

  ripenPomodoro(timerStatus) {
    const { workDuration, remainingTime, currentCycles } = timerStatus;
    const pomodoroId = `pomodoro-${currentCycles}`;
    const pomodoroElement = document.getElementById(pomodoroId);

    const colorRange = {
      redStart: 64,
      redEnd: 255,
      greenStart: 128,
      greenEnd: 32,
      blueValue: 0,
    };

    const redValue = this.#calculateColorValue(
      colorRange.redStart,
      colorRange.redEnd,
      remainingTime,
      workDuration
    );

    const greenValue = this.#calculateColorValue(
      colorRange.greenStart,
      colorRange.greenEnd,
      remainingTime,
      workDuration
    );

    pomodoroElement.style.backgroundColor = `rgb(${redValue}, ${greenValue}, ${colorRange.blueValue})`;
  }

  clearPomodori() {
    this.#elements.pomodoroContainer.innerHTML = "";
  }

  #getDOMElements() {
    return {
      remainingTime: document.getElementById("remaining-time"),
      statusDisplay: document.getElementById("status"),
      startButton: document.getElementById("start-button"),
      pauseButton: document.getElementById("pause-button"),
      resetButton: document.getElementById("reset-button"),
      resumeButton: document.getElementById("resume-button"),
      pomodoroContainer: document.getElementById("pomodoro-container"),
    };
  }

  #toggleButton(button, show) {
    if (show) {
      button.classList.remove("btn-hidden");
      button.classList.add("btn-visible");
    } else {
      button.classList.remove("btn-visible");
      button.classList.add("btn-hidden");
    }
  }

  #formatTime(minutes, seconds) {
    const formattedMinutes = minutes < 10 ? `0${minutes}` : `${minutes}`;
    const formattedSeconds = seconds < 10 ? `0${seconds}` : `${seconds}`;
    return `${formattedMinutes}:${formattedSeconds}`;
  }

  #createPomodoro(id) {
    const pomodoro = document.createElement("div");
    pomodoro.id = id;
    pomodoro.classList.add("pomodoro");
    return pomodoro;
  }

  #createStemAndLeaves() {
    const fragment = document.createDocumentFragment();

    const stem = document.createElement("div");
    stem.classList.add("stem-leaf");
    fragment.appendChild(stem);

    for (let i = 1; i <= 5; i++) {
      const leaf = document.createElement("div");
      leaf.classList.add("stem-leaf", `leaf-${i}`);
      fragment.appendChild(leaf);
    }

    return fragment;
  }

  #calculateColorValue(start, end, remainingTime, workDuration) {
    return Math.floor(
      start + (end - start) * (1 - remainingTime / workDuration)
    );
  }
}
