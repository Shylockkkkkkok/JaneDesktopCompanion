/** Body position categories — the first five supported in this phase. */
export type CharacterPose =
  | "standing"
  | "sitting"
  | "relaxed"
  | "focus"
  | "concert";

/** Unified per-photo metadata. */
export interface PhotoAssetMeta {
  id: string;
  src: string;
  /** Pose category. */
  category: CharacterPose;
  /** Outfit/look id. The selector does NOT randomly switch lookId during idle. */
  lookId: string;
  /** Relative size multiplier on top of the user's character scale. */
  scale: number;
  /** Pixel offsets to fine-tune anchoring. */
  offsetX: number;
  offsetY: number;
  /** Selection weight (higher = more likely to be picked). */
  weight: number;
  enabled: boolean;
}
