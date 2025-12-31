import { SECONDS_PER_MINUTE } from "../constants";

export const formatSecondsAsClock = (totalSeconds: number) => {
  const minutes = Math.floor(totalSeconds / SECONDS_PER_MINUTE);
  const seconds = totalSeconds % SECONDS_PER_MINUTE;
  return `${minutes.toString().padStart(2, "0")}:${seconds
    .toString()
    .padStart(2, "0")}`;
};

export const getPomodoroColorForRemainingSeconds = (
  remainingSeconds: number,
  workDurationSeconds: number
) => {
  const colorRange = {
    redStart: 64,
    redEnd: 255,
    greenStart: 128,
    greenEnd: 32,
    blueValue: 0,
  };

  const ratio = 1 - remainingSeconds / workDurationSeconds;
  const redValue = Math.floor(
    colorRange.redStart + (colorRange.redEnd - colorRange.redStart) * ratio
  );
  const greenValue = Math.floor(
    colorRange.greenStart +
      (colorRange.greenEnd - colorRange.greenStart) * ratio
  );

  return `rgb(${redValue}, ${greenValue}, ${colorRange.blueValue})`;
};
