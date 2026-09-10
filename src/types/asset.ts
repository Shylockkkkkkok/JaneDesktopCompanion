import type { CharacterExpression, CharacterState } from "./character";

export type AssetType = "static" | "animatedImage" | "sequence";

export interface StaticAsset {
  type: "static";
  src: string;
}

/** Animated GIF / APNG / WebP — the browser animates it for us. */
export interface AnimatedImageAsset {
  type: "animatedImage";
  src: string;
}

/** A PNG sequence, cycled manually at a fixed fps. */
export interface SequenceAsset {
  type: "sequence";
  frames: string[];
  fps: number;
}

/**
 * A self-playing video clip (WebM VP9 with alpha). The browser decodes and
 * composites it; transparency comes from the video's own alpha channel.
 */
export interface VideoAsset {
  type: "video";
  src: string;
  loop: boolean;
  muted: boolean;
  playbackRate?: number;
}

export type CharacterAsset =
  | StaticAsset
  | AnimatedImageAsset
  | SequenceAsset
  | VideoAsset;

export type AssetManifest = Partial<
  Record<CharacterState, Partial<Record<CharacterExpression, CharacterAsset>>>
>;
