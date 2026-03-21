import { useEffect, useRef, useState } from "react";

interface ParsedData {
  max: number;
  peaks: number[];
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
    const worker = new Worker(
      new URL(
        "@web-speed-hackathon-2026/client/src/workers/sound_wave_worker.ts",
        import.meta.url,
      ),
    );
    worker.postMessage(soundData.slice(0));
    worker.addEventListener("message", (e: MessageEvent<ParsedData>) => {
      setPeaks(e.data);
      worker.terminate();
    });
    return () => {
      worker.terminate();
    };
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
