import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const SAMPLE_RATE = 44100;

const validateToneParameters = (frequency, duration, volume) => {
  if (frequency <= 0) {
    throw new Error("Frequency must be positive.");
  }
  if (duration <= 0) {
    throw new Error("Duration must be positive.");
  }
  if (volume < 0 || volume > 1) {
    throw new Error("Volume must be between 0 and 1.");
  }
};

const generateToneSamples = (frequency, duration, volume) => {
  validateToneParameters(frequency, duration, volume);
  const sampleCount = Math.floor(SAMPLE_RATE * duration);
  const samples = new Int16Array(sampleCount);
  const amplitude = Math.floor((2 ** 15 - 1) * volume);

  for (let i = 0; i < sampleCount; i += 1) {
    const t = i / SAMPLE_RATE;
    samples[i] = Math.floor(Math.sin(2 * Math.PI * frequency * t) * amplitude);
  }

  return samples;
};

const buildWavBuffer = (samples) => {
  const bytesPerSample = 2;
  const dataSize = samples.length * bytesPerSample;
  const buffer = Buffer.alloc(44 + dataSize);

  buffer.write("RIFF", 0);
  buffer.writeUInt32LE(36 + dataSize, 4);
  buffer.write("WAVE", 8);
  buffer.write("fmt ", 12);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(1, 22);
  buffer.writeUInt32LE(SAMPLE_RATE, 24);
  buffer.writeUInt32LE(SAMPLE_RATE * bytesPerSample, 28);
  buffer.writeUInt16LE(bytesPerSample, 32);
  buffer.writeUInt16LE(16, 34);
  buffer.write("data", 36);
  buffer.writeUInt32LE(dataSize, 40);

  for (let i = 0; i < samples.length; i += 1) {
    buffer.writeInt16LE(samples[i], 44 + i * bytesPerSample);
  }

  return buffer;
};

const saveTone = (filename, frequency, duration, volume = 0.5) => {
  const samples = generateToneSamples(frequency, duration, volume);
  const wavBuffer = buildWavBuffer(samples);
  fs.writeFileSync(filename, wavBuffer);
};

const ensureDir = (dir) => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
};

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const outputDir = path.join(__dirname, "..", "public");
ensureDir(outputDir);

saveTone(path.join(outputDir, "alarm.wav"), 880, 1);
saveTone(path.join(outputDir, "low_alarm.wav"), 440, 0.3);

console.log("Generated alarm.wav and low_alarm.wav in public/");
