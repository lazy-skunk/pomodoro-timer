const SECONDS_IN_A_MINUTE = 60;
export const timerConfig = {
  workDuration: 25 * SECONDS_IN_A_MINUTE,
  shortBreakDuration: 5 * SECONDS_IN_A_MINUTE,
  longBreakDuration: 15 * SECONDS_IN_A_MINUTE,
};

export const audioConfig = {
  alarmUrl: "/static/alarm.wav",
  lowAlarmUrl: "/static/low_alarm.wav",
};
