import { useEffect, useRef } from "react";

export interface VideoActionViewProps {
  src: string;
  loop: boolean;
  muted: boolean;
  playbackRate?: number;
  paused: boolean;
  /** Remount key — bumped on (re)play so the video restarts from 0. */
  nonce: number;
  /** Rendered height in px (baseHeight × action scale). */
  height: number;
  offsetX: number;
  offsetY: number;
  onEnded: () => void;
  onProgress: (currentTime: number, duration: number, paused: boolean) => void;
  /** Reports intrinsic video size once metadata is available. */
  onVideoSize: (width: number, height: number) => void;
}

/**
 * Renders one CharacterAction video clip. The element exists only while the
 * action plays, so nothing is loaded at app startup (preload="auto" applies
 * to this single clip; the browser caches it after the first play).
 *
 * Desktop-companion constraints: autoplay + muted + playsInline, no controls,
 * no PiP / remote playback, alpha compositing comes from the WebM itself.
 * An error fires onEnded too — a broken file must never wedge the action
 * state.
 */
export function CharacterVideoActionView({
  src,
  loop,
  muted,
  playbackRate,
  paused,
  nonce,
  height,
  offsetX,
  offsetY,
  onEnded,
  onProgress,
  onVideoSize,
}: VideoActionViewProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    if (paused) {
      v.pause();
    } else {
      const p = v.play();
      // autoplay can reject while the element is still loading — harmless.
      if (p) p.catch(() => {});
    }
  }, [paused]);

  useEffect(() => {
    const v = videoRef.current;
    if (!v || !playbackRate) return;
    v.playbackRate = playbackRate;
  }, [playbackRate]);

  return (
    <div
      className="character__video"
      style={{ transform: `translate(${offsetX}px, ${offsetY}px)` }}
    >
      <video
        key={nonce}
        ref={videoRef}
        className="character__video-element"
        src={src}
        autoPlay
        muted={muted}
        loop={loop}
        playsInline
        preload="auto"
        controls={false}
        disablePictureInPicture
        disableRemotePlayback
        style={{ height }}
        onEnded={onEnded}
        onError={onEnded}
        onTimeUpdate={() => {
          const v = videoRef.current;
          if (v) onProgress(v.currentTime, v.duration || 0, v.paused);
        }}
        onPlay={() => {
          const v = videoRef.current;
          if (v) onProgress(v.currentTime, v.duration || 0, false);
        }}
        onPause={() => {
          const v = videoRef.current;
          if (v) onProgress(v.currentTime, v.duration || 0, true);
        }}
        onLoadedMetadata={() => {
          const v = videoRef.current;
          if (!v) return;
          if (playbackRate) v.playbackRate = playbackRate;
          onVideoSize(v.videoWidth, v.videoHeight);
        }}
      />
    </div>
  );
}
