/* @vitest-environment jsdom */
import { beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { PomodoroTimerAudioEngine } from "./PomodoroAudioEngine";

class FakeAudioParam {
  public readonly setValueAtTimeCalls: Array<[number, number]> = [];
  public readonly exponentialRampToValueAtTimeCalls: Array<[number, number]> = [];

  public setValueAtTime(value: number, time: number) {
    this.setValueAtTimeCalls.push([value, time]);
  }

  public exponentialRampToValueAtTime(value: number, time: number) {
    this.exponentialRampToValueAtTimeCalls.push([value, time]);
  }
}

class FakeGainNode {
  public readonly gain = new FakeAudioParam();
  public readonly connect = vi.fn();
  public readonly disconnect = vi.fn();
}

class FakeOscillatorNode {
  public readonly frequency = new FakeAudioParam();
  public readonly connect = vi.fn();
  public readonly disconnect = vi.fn();
  public readonly start = vi.fn();
  public readonly stop = vi.fn();
  public type = "";
  public onended: (() => void) | null = null;
}

class FakeAudioContext {
  public state: "running" | "suspended" | "closed" = "suspended";
  public currentTime = 42;
  public readonly destination = {};
  public readonly oscillators: FakeOscillatorNode[] = [];
  public readonly gainNodes: FakeGainNode[] = [];
  public readonly resume = vi.fn(async () => {
    this.state = "running";
  });
  public readonly close = vi.fn(async () => {
    this.state = "closed";
  });

  public createOscillator() {
    const oscillator = new FakeOscillatorNode();
    this.oscillators.push(oscillator);
    return oscillator as unknown as OscillatorNode;
  }

  public createGain() {
    const gainNode = new FakeGainNode();
    this.gainNodes.push(gainNode);
    return gainNode as unknown as GainNode;
  }
}

const installFakeAudioContext = (state: FakeAudioContext["state"] = "suspended") => {
  const audioContext = new FakeAudioContext();
  audioContext.state = state;
  const AudioContextMock = vi.fn(function AudioContextMock() {
    return audioContext;
  });
  Object.defineProperty(window, "AudioContext", {
    configurable: true,
    value: AudioContextMock,
  });

  return { audioContext, AudioContextMock };
};

describe("PomodoroTimerAudioEngine", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("creates and resumes an audio context during prepare", async () => {
    const { audioContext, AudioContextMock } = installFakeAudioContext();

    const engine = new PomodoroTimerAudioEngine();
    const preparedContext = await engine.prepare();

    expect(AudioContextMock).toHaveBeenCalledTimes(1);
    expect(audioContext.resume).toHaveBeenCalledTimes(1);
    expect(preparedContext).toBe(audioContext);
    expect(engine.getAudioContext()).toBe(audioContext);
  });

  it("schedules an alarm tone when the context is running", async () => {
    const { audioContext } = installFakeAudioContext("running");

    const engine = new PomodoroTimerAudioEngine();
    await engine.prepare();
    engine.scheduleAlarm(10);

    const oscillator = audioContext.oscillators[0];
    const gainNode = audioContext.gainNodes[0];

    expect(oscillator.type).toBe("triangle");
    expect(oscillator.frequency.setValueAtTimeCalls[0]).toEqual([880, 10]);
    expect(gainNode.gain.setValueAtTimeCalls[0]).toEqual([0.0001, 10]);
    expect(oscillator.start).toHaveBeenCalledWith(10);
    expect(oscillator.stop).toHaveBeenCalled();
  });

  it("stops all scheduled oscillators at the current audio time", async () => {
    const { audioContext } = installFakeAudioContext("running");

    const engine = new PomodoroTimerAudioEngine();
    await engine.prepare();
    engine.scheduleAlarm(10);
    engine.scheduleLowAlarm(11);

    engine.stop();

    expect(audioContext.oscillators).toHaveLength(2);
    for (const oscillator of audioContext.oscillators) {
      expect(oscillator.stop).toHaveBeenLastCalledWith(audioContext.currentTime);
    }
  });

  it("closes the audio context on dispose", async () => {
    const { audioContext } = installFakeAudioContext("running");

    const engine = new PomodoroTimerAudioEngine();
    await engine.prepare();
    await engine.dispose();

    expect(audioContext.close).toHaveBeenCalledTimes(1);
    expect(engine.getAudioContext()).toBeNull();
  });
});
