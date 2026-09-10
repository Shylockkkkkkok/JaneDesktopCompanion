import type { AssetManifest, CharacterAsset } from "../types/asset";
import type { CharacterExpression, CharacterState } from "../types/character";
import characterPlaceholder from "../assets/character-placeholder.png";

const STATIC_PLACEHOLDER: CharacterAsset = {
  type: "static",
  src: characterPlaceholder,
};

/**
 * Unified asset manifest: (state, expression) → asset. The business layer
 * never sees file paths; it only asks for a state + expression.
 *
 * To add real Jane art later, extend this map with any asset type:
 *
 *   idle: {
 *     neutral: { type: "sequence", frames: [idle0, idle1, idle2], fps: 12 },
 *     softSmile: { type: "static", src: janeIdleSmile },
 *   },
 *   sitting: { neutral: { type: "animatedImage", src: janeSitWebp } },
 */
export const CHARACTER_ASSETS: AssetManifest = {
  idle: { neutral: STATIC_PLACEHOLDER },
  hover: { neutral: STATIC_PLACEHOLDER },
  reaction: { neutral: STATIC_PLACEHOLDER },
};

/** Global fallback used when a (state, expression) is missing entirely. */
export const FALLBACK_ASSET: CharacterAsset = STATIC_PLACEHOLDER;

/**
 * Resolve an asset with graceful fallback:
 * exact (state, expression) → that state's neutral → idle neutral → global fallback.
 */
export function resolveAsset(
  state: CharacterState,
  expression: CharacterExpression,
): CharacterAsset {
  const stateAssets = CHARACTER_ASSETS[state];
  return (
    stateAssets?.[expression] ??
    stateAssets?.neutral ??
    CHARACTER_ASSETS.idle?.neutral ??
    FALLBACK_ASSET
  );
}

/**
 * Integrity check for a PNG sequence: non-empty frame list, positive fps, and
 * every frame URL non-empty. Intended for dev-time manifest validation.
 */
export function validateSequence(asset: CharacterAsset): boolean {
  if (asset.type !== "sequence") return true;
  return (
    asset.frames.length > 0 &&
    asset.fps > 0 &&
    asset.frames.every((f) => f.length > 0)
  );
}
