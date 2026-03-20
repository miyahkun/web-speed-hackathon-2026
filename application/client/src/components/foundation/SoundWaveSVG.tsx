import { useEffect, useRef, useState } from "react";

interface ParsedData {
  max: number;
  peaks: number[];
}

const PEAK_COUNT = 100;

async function calculate(data: ArrayBuffer): Promise<ParsedData> {
  const audioCtx = new AudioContext();
  const buffer = await audioCtx.decodeAudioData(data.slice(0));

  const left = buffer.getChannelData(0);
  const right = buffer.numberOfChannels > 1 ? buffer.getChannelData(1) : left;
  const len = left.length;
  const chunkSize = Math.ceil(len / PEAK_COUNT);

  const peaks = new Array<number>(PEAK_COUNT);
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

  await audioCtx.close();
  return { max, peaks };
}

interface Props {
  soundData: ArrayBuffer;
}

export const SoundWaveSVG = ({ soundData }: Props) => {
  const uniqueIdRef = useRef(Math.random().toString(16));
  const [{ max, peaks }, setPeaks] = useState<ParsedData>({
    max: 0,
    peaks: [],
  });

  useEffect(() => {
    calculate(soundData).then(({ max, peaks }) => {
      setPeaks({ max, peaks });
    });
  }, [soundData]);

  return (
    <svg className="h-full w-full" preserveAspectRatio="none" viewBox="0 0 100 1">
      {peaks.map((peak, idx) => {
        const ratio = peak / max;
        return (
          <rect
            key={`${uniqueIdRef.current}#${idx}`}
            fill="var(--color-cax-accent)"
            height={ratio}
            width="1"
            x={idx}
            y={1 - ratio}
          />
        );
      })}
    </svg>
  );
};
