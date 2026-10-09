export const records = Array.from({ length: 1000 }, (_, index) => ({ id: String(index).padStart(3, '0'), quantity: index * 7 % 99 + 1 }));
export const createWave = () => {
  const sampleRate = 8000, samples = sampleRate * 8, wave = Buffer.alloc(44 + samples * 2);
  wave.write('RIFF', 0); wave.writeUInt32LE(wave.length - 8, 4); wave.write('WAVEfmt ', 8);
  wave.writeUInt32LE(16, 16); wave.writeUInt16LE(1, 20); wave.writeUInt16LE(1, 22);
  wave.writeUInt32LE(sampleRate, 24); wave.writeUInt32LE(sampleRate * 2, 28); wave.writeUInt16LE(2, 32); wave.writeUInt16LE(16, 34);
  wave.write('data', 36); wave.writeUInt32LE(samples * 2, 40);
  for (let index = 0; index < samples; index += 1) wave.writeInt16LE(Math.round(Math.sin(index / sampleRate * Math.PI * 440) * 1200), 44 + index * 2);
  return wave;
};
