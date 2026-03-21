const PEAK_COUNT = 100;

interface ParsedData {
  max: number;
  peaks: number[];
}

async function calculate(data: ArrayBuffer): Promise<ParsedData> {
  const audioCtx = new OfflineAudioContext(1, 1, 44100);
  const buffer = await audioCtx.decodeAudioData(data);

  const left = buffer.getChannelData(0);
  const right = buffer.numberOfChannels > 1 ? buffer.getChannelData(1) : left;
  const len = left.length;
  const chunkSize = Math.ceil(len / PEAK_COUNT);

  const peaks = Array.from<number>({ length: PEAK_COUNT });
  let max = 0;

  for (let i = 0; i < PEAK_COUNT; i++) {
    const start = i * chunkSize;
    const end = Math.min(start + chunkSize, len);
    let sum = 0;
    for (let j = start; j < end; j++) {
      sum += (Math.abs(left[j]!) + Math.abs(right[j]!)) * 0.5;
    }
    const avg = sum / (end - start);
    peaks[i] = avg;
    if (avg > max) max = avg;
  }

  return { max, peaks };
}

self.addEventListener("message", async (e: MessageEvent<ArrayBuffer>) => {
  const result = await calculate(e.data);
  self.postMessage(result);
});
