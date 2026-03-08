const ALARM_FREQUENCY_HZ = 880;
const LOW_ALARM_FREQUENCY_HZ = 440;
const ALARM_DURATION_SECONDS = 1.0;
const LOW_ALARM_DURATION_SECONDS = 0.5;
const FADE_SECONDS = 0.025;
const SILENT_GAIN = 0.0001;
const MAX_GAIN = 0.5;

const resolveAudioContextConstructor = () => {
  return (
    window.AudioContext ||
    (window as Window & { webkitAudioContext?: typeof AudioContext })
      .webkitAudioContext ||
    null
  );
};

export class PomodoroTimerAudioEngine {
  private audioContext: AudioContext | null = null;
  private scheduledOscillators = new Set<OscillatorNode>();

  public async warmUp() {
    const audioContext = await this.getOrCreateAudioContext();
    if (!audioContext) {
      return false;
    }

    if (audioContext.state === "suspended") {
      await audioContext.resume();
    }

    return true;
  }

  public playAlarm() {
    this.playTone(ALARM_FREQUENCY_HZ, ALARM_DURATION_SECONDS);
  }

  public playLowAlarm() {
    this.playTone(LOW_ALARM_FREQUENCY_HZ, LOW_ALARM_DURATION_SECONDS);
  }

  public async dispose() {
    this.stopScheduledOscillators();
    if (this.audioContext) {
      await this.audioContext.close();
      this.audioContext = null;
    }
  }

  private async getOrCreateAudioContext() {
    if (this.audioContext) {
      return this.audioContext;
    }

    const AudioContextConstructor = resolveAudioContextConstructor();
    if (!AudioContextConstructor) {
      return null;
    }

    this.audioContext = new AudioContextConstructor();
    return this.audioContext;
  }

  private playTone(frequencyHz: number, durationSeconds: number) {
    if (!this.audioContext || this.audioContext.state !== "running") {
      return;
    }

    const playbackTimeSeconds = this.audioContext.currentTime;
    const endTimeSeconds = playbackTimeSeconds + durationSeconds;
    const fadeOutStartTimeSeconds = Math.max(
      playbackTimeSeconds + FADE_SECONDS,
      endTimeSeconds - FADE_SECONDS,
    );
    const oscillatorNode = this.audioContext.createOscillator();
    const gainNode = this.audioContext.createGain();

    oscillatorNode.type = "triangle";
    oscillatorNode.frequency.setValueAtTime(frequencyHz, playbackTimeSeconds);
    gainNode.gain.setValueAtTime(SILENT_GAIN, playbackTimeSeconds);
    gainNode.gain.linearRampToValueAtTime(
      MAX_GAIN,
      playbackTimeSeconds + FADE_SECONDS,
    );
    gainNode.gain.setValueAtTime(MAX_GAIN, fadeOutStartTimeSeconds);
    gainNode.gain.linearRampToValueAtTime(SILENT_GAIN, endTimeSeconds);

    oscillatorNode.connect(gainNode);
    gainNode.connect(this.audioContext.destination);
    this.scheduledOscillators.add(oscillatorNode);
    oscillatorNode.onended = () => {
      this.scheduledOscillators.delete(oscillatorNode);
      oscillatorNode.disconnect();
      gainNode.disconnect();
    };
    oscillatorNode.start(playbackTimeSeconds);
    oscillatorNode.stop(endTimeSeconds);
  }

  private stopScheduledOscillators() {
    if (!this.audioContext || this.scheduledOscillators.size === 0) {
      return;
    }

    const stopTimeSeconds = this.audioContext.currentTime;
    for (const oscillatorNode of this.scheduledOscillators) {
      try {
        oscillatorNode.stop(stopTimeSeconds);
      } catch (error) {
        if (process.env.NODE_ENV !== "production") {
          console.debug(
            "PomodoroTimerAudioEngine: oscillator stop skipped (already ended or not stoppable).",
            error,
          );
        }
      }
    }
  }
}
