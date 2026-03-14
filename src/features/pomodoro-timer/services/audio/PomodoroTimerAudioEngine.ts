const ALARM_FREQUENCY_HZ = 880;
const LOW_ALARM_FREQUENCY_HZ = 440;
const NOTIFICATION_ATTACK_GAIN = 0.5;
const SILENT_GAIN = 0.0001;
const ENVELOPE_EDGE_SECONDS = 0.001;
const ALARM_SUSTAIN_RATIO = 0.9;
const LOW_ALARM_SUSTAIN_RATIO = 0.5;
const ALARM_DURATION_SECONDS = 1.0;
const LOW_ALARM_DURATION_SECONDS = 0.5;
const STOP_BUFFER_SECONDS = 0.01;

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

  public stop() {
    this.stopScheduledOscillators();
  }

  public async dispose() {
    this.stop();
    if (this.audioContext) {
      await this.audioContext.close();
      this.audioContext = null;
    }
  }

  public getAudioContext() {
    return this.audioContext;
  }

  public async prepare() {
    if (this.audioContext) {
      if (this.audioContext.state === "suspended") {
        await this.audioContext.resume();
      }
      return this.audioContext;
    }

    const AudioContextConstructor = resolveAudioContextConstructor();
    if (!AudioContextConstructor) {
      return null;
    }

    this.audioContext = new AudioContextConstructor();
    if (this.audioContext.state === "suspended") {
      await this.audioContext.resume();
    }

    return this.audioContext;
  }

  public scheduleAlarm(playbackTimeSeconds: number) {
    this.scheduleTone(
      playbackTimeSeconds,
      ALARM_FREQUENCY_HZ,
      NOTIFICATION_ATTACK_GAIN,
      ALARM_DURATION_SECONDS * ALARM_SUSTAIN_RATIO,
      ALARM_DURATION_SECONDS,
    );
  }

  public scheduleLowAlarm(playbackTimeSeconds: number) {
    this.scheduleTone(
      playbackTimeSeconds,
      LOW_ALARM_FREQUENCY_HZ,
      NOTIFICATION_ATTACK_GAIN,
      LOW_ALARM_DURATION_SECONDS * LOW_ALARM_SUSTAIN_RATIO,
      LOW_ALARM_DURATION_SECONDS,
    );
  }

  private scheduleTone(
    playbackTimeSeconds: number,
    frequencyHz: number,
    attackGain: number,
    sustainSeconds: number,
    durationSeconds: number,
  ) {
    if (!this.audioContext || this.audioContext.state !== "running") {
      return;
    }

    const sustainEndTimeSeconds = Math.max(
      playbackTimeSeconds + ENVELOPE_EDGE_SECONDS + sustainSeconds,
      playbackTimeSeconds + durationSeconds - ENVELOPE_EDGE_SECONDS,
    );
    const decayEndTimeSeconds = sustainEndTimeSeconds + ENVELOPE_EDGE_SECONDS;
    const oscillatorNode = this.audioContext.createOscillator();
    const gainNode = this.audioContext.createGain();

    oscillatorNode.type = "triangle";
    oscillatorNode.frequency.setValueAtTime(frequencyHz, playbackTimeSeconds);
    gainNode.gain.setValueAtTime(SILENT_GAIN, playbackTimeSeconds);
    gainNode.gain.exponentialRampToValueAtTime(
      attackGain,
      playbackTimeSeconds + ENVELOPE_EDGE_SECONDS,
    );
    gainNode.gain.setValueAtTime(attackGain, sustainEndTimeSeconds);
    gainNode.gain.exponentialRampToValueAtTime(
      SILENT_GAIN,
      decayEndTimeSeconds,
    );

    oscillatorNode.connect(gainNode);
    gainNode.connect(this.audioContext.destination);
    this.scheduledOscillators.add(oscillatorNode);
    oscillatorNode.onended = () => {
      this.scheduledOscillators.delete(oscillatorNode);
      oscillatorNode.disconnect();
      gainNode.disconnect();
    };
    oscillatorNode.start(playbackTimeSeconds);
    oscillatorNode.stop(decayEndTimeSeconds + STOP_BUFFER_SECONDS);
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
