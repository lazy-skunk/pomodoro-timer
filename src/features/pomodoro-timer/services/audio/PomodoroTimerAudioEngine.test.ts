// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from "vitest";
import { PomodoroTimerAudioEngine } from "@/features/pomodoro-timer/services/audio/PomodoroTimerAudioEngine";

class FakeAudioParam {
  public readonly setValueAtTimeCalls: Array<[number, number]> = [];
  public readonly exponentialRampToValueAtTimeCalls: Array<[number, number]> =
    [];

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
  public readonly stopCalls: Array<number | undefined> = [];
  public readonly stop = vi.fn((time?: number) => {
    this.stopCalls.push(time);
  });
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

describe("PomodoroTimerAudioEngine", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("creates and resumes an audio context during prepare", async () => {
    const fakeAudioContext = new FakeAudioContext();
    const AudioContextMock = vi.fn(function AudioContextMock() {
      return fakeAudioContext;
    });
    Object.defineProperty(window, "AudioContext", {
      configurable: true,
      value: AudioContextMock,
    });

    const engine = new PomodoroTimerAudioEngine();
    const preparedContext = await engine.prepare();

    expect(AudioContextMock).toHaveBeenCalledTimes(1);
    expect(fakeAudioContext.resume).toHaveBeenCalledTimes(1);
    expect(preparedContext).toBe(fakeAudioContext);
    expect(engine.getAudioContext()).toBe(fakeAudioContext);
  });

  it("schedules an alarm tone when the context is running", async () => {
    const fakeAudioContext = new FakeAudioContext();
    fakeAudioContext.state = "running";
    const AudioContextMock = vi.fn(function AudioContextMock() {
      return fakeAudioContext;
    });
    Object.defineProperty(window, "AudioContext", {
      configurable: true,
      value: AudioContextMock,
    });

    const engine = new PomodoroTimerAudioEngine();
    await engine.prepare();
    engine.scheduleAlarm(10);

    const oscillator = fakeAudioContext.oscillators[0];
    const gainNode = fakeAudioContext.gainNodes[0];

    expect(oscillator.type).toBe("triangle");
    expect(oscillator.frequency.setValueAtTimeCalls[0]).toEqual([880, 10]);
    expect(gainNode.gain.setValueAtTimeCalls[0]).toEqual([0.0001, 10]);
    expect(oscillator.start).toHaveBeenCalledWith(10);
    expect(oscillator.stop).toHaveBeenCalled();
  });

  it("stops all scheduled oscillators at the current audio time", async () => {
    const fakeAudioContext = new FakeAudioContext();
    fakeAudioContext.state = "running";
    const AudioContextMock = vi.fn(function AudioContextMock() {
      return fakeAudioContext;
    });
    Object.defineProperty(window, "AudioContext", {
      configurable: true,
      value: AudioContextMock,
    });

    const engine = new PomodoroTimerAudioEngine();
    await engine.prepare();
    engine.scheduleAlarm(10);
    engine.scheduleLowAlarm(11);

    engine.stop();

    expect(fakeAudioContext.oscillators).toHaveLength(2);
    for (const oscillator of fakeAudioContext.oscillators) {
      expect(oscillator.stop).toHaveBeenLastCalledWith(
        fakeAudioContext.currentTime,
      );
    }
  });

  it("closes the audio context on dispose", async () => {
    const fakeAudioContext = new FakeAudioContext();
    fakeAudioContext.state = "running";
    const AudioContextMock = vi.fn(function AudioContextMock() {
      return fakeAudioContext;
    });
    Object.defineProperty(window, "AudioContext", {
      configurable: true,
      value: AudioContextMock,
    });

    const engine = new PomodoroTimerAudioEngine();
    await engine.prepare();
    await engine.dispose();

    expect(fakeAudioContext.close).toHaveBeenCalledTimes(1);
    expect(engine.getAudioContext()).toBeNull();
  });
});
