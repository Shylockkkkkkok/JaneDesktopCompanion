import type { SequenceAsset, VideoAsset } from "./asset";

/**
 * CharacterAction — a one-shot short motion (wave / heart / dance …), fully
 * separate from CharacterState (which stays long-lived: idle / focus /
 * concert). Backed by either a PNG sequence or a transparent video clip.
 */
export interface CharacterActionDefinition {
  id: string;
  label: string;
  /** Registry key: ACTION_SEQUENCES or ACTION_VIDEOS (config/characterActions.ts). */
  assetId: string;
  loop: boolean;
  interruptible: boolean;
  /** Registry-level enable flag; availability also requires a valid asset. */
  enabled: boolean;
  /** Menu sort order (ascending, missing → last). */
  order?: number;
  /** "stage" actions stay usable during Concert Mode. */
  tags?: string[];
}

/** Which pipeline backs a resolved action. */
export type ResolvedActionKind = "sequence" | "video";

/** A definition whose asset resolved and validated, ready to play. */
export interface ResolvedCharacterAction {
  def: CharacterActionDefinition;
  asset: SequenceAsset | VideoAsset;
  kind: ResolvedActionKind;
}

/** Snapshot of the player, consumed by the renderer and the debug panel. */
export interface ActionPlayState {
  actionId: string;
  kind: ResolvedActionKind;
  loop: boolean;
  interruptible: boolean;
  playing: boolean;
  /** sequence only */
  frame: number;
  totalFrames: number;
  fps: number;
  /** video only */
  src?: string;
  currentTime?: number;
  duration?: number;
  paused?: boolean;
  /** Intrinsic video size (reported from loadedmetadata). */
  videoWidth?: number;
  videoHeight?: number;
  /** Bumped on restart so the <video> remounts and replays from 0. */
  nonce?: number;
}

/**
 * Render-ready action payload passed down App → CharacterRoot →
 * CharacterRenderer. Exactly one branch renders; during an action the static
 * Jane is fully replaced (never both at once).
 */
export type CharacterActionView =
  | { kind: "sequence"; frames: string[]; frame: number }
  | {
      kind: "video";
      src: string;
      loop: boolean;
      muted: boolean;
      playbackRate?: number;
      paused: boolean;
      nonce: number;
      height: number;
      offsetX: number;
      offsetY: number;
      onEnded: () => void;
      onProgress: (currentTime: number, duration: number, paused: boolean) => void;
      onVideoSize: (width: number, height: number) => void;
    };
