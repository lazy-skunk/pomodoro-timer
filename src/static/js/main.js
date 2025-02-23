import { PubSub } from "./pub_sub.js";
import { PomodoroTimerModel } from "./pomodoro_timer_model.js";
import { PomodoroTimerUI } from "./pomodoro_timer_ui.js";
import { PomodoroTimerController } from "./pomodoro_timer_controller.js";
import { timerConfig, audioConfig } from "./config.js";

const pubsub = new PubSub();

const alarm = new Audio(audioConfig.alarmUrl);
const lowAlarm = new Audio(audioConfig.lowAlarmUrl);

const pomodoroTimerUI = new PomodoroTimerUI(alarm, lowAlarm);

const pomodoroTimerModel = new PomodoroTimerModel(timerConfig, pubsub);

const pomodoroTimerController = new PomodoroTimerController(
  pomodoroTimerModel,
  pomodoroTimerUI,
  pubsub
);

document.addEventListener("DOMContentLoaded", () => {
  pomodoroTimerController.initialize();
});
