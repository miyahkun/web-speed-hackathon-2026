import classNames from "classnames";
import { useCallback, useEffect, useRef, useState } from "react";

import { AspectRatioBox } from "@web-speed-hackathon-2026/client/src/components/foundation/AspectRatioBox";
import { FontAwesomeIcon } from "@web-speed-hackathon-2026/client/src/components/foundation/FontAwesomeIcon";
import { useInView } from "@web-speed-hackathon-2026/client/src/hooks/use_in_view";

interface Props {
  src: string;
  priority?: boolean;
}

/**
 * クリックすると再生・一時停止を切り替えます。
 */
export const PausableMovie = ({ src, priority = false }: Props) => {
  const [inViewRef, inView] = useInView();
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number>(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);

  const drawFrame = useCallback(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    if (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight) {
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
    }

    ctx.drawImage(video, 0, 0);

    if (!video.paused && !video.ended) {
      rafRef.current = requestAnimationFrame(drawFrame);
    }
  }, []);

  const handleClick = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;

    if (video.paused) {
      video.play();
      setIsPlaying(true);
    } else {
      video.pause();
      setIsPlaying(false);
    }
  }, []);

  const handlePlay = useCallback(() => {
    cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(drawFrame);
  }, [drawFrame]);

  const handleLoadedData = useCallback(() => {
    setIsLoaded(true);
    const video = videoRef.current;
    if (!video) return;

    drawFrame();

    // 視覚効果 off のとき自動再生しない
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      video.pause();
      setIsPlaying(false);
    } else {
      video.play();
      setIsPlaying(true);
    }
  }, [drawFrame]);

  useEffect(() => {
    return () => cancelAnimationFrame(rafRef.current);
  }, []);

  const shouldRender = priority || inView;

  if (!shouldRender) {
    return (
      <div ref={inViewRef}>
        <AspectRatioBox aspectHeight={1} aspectWidth={1}>
          <div className="bg-cax-surface-subtle h-full w-full" />
        </AspectRatioBox>
      </div>
    );
  }

  return (
    <AspectRatioBox aspectHeight={1} aspectWidth={1}>
      <button
        aria-label="動画プレイヤー"
        className="group relative block h-full w-full"
        onClick={handleClick}
        type="button"
      >
        <video
          ref={videoRef}
          className="hidden"
          src={src}
          loop
          muted
          playsInline
          preload={priority ? "auto" : "metadata"}
          onLoadedData={handleLoadedData}
          onPlay={handlePlay}
        />
        <canvas ref={canvasRef} className="h-full w-full object-cover" />
        {!isLoaded && <div className="bg-cax-surface-subtle absolute inset-0" />}
        <div
          className={classNames(
            "absolute left-1/2 top-1/2 flex items-center justify-center w-16 h-16 text-cax-surface-raised text-3xl bg-cax-overlay/50 rounded-full -translate-x-1/2 -translate-y-1/2",
            {
              "opacity-0 group-hover:opacity-100": isPlaying,
            },
          )}
        >
          <FontAwesomeIcon iconType={isPlaying ? "pause" : "play"} styleType="solid" />
        </div>
      </button>
    </AspectRatioBox>
  );
};
