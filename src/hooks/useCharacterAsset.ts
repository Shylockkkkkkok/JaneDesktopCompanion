import { useEffect, useState } from "react";
import type { CharacterAsset } from "../types/asset";
import type { CharacterExpression, CharacterState } from "../types/character";
import { FALLBACK_ASSET, resolveAsset } from "../config/characterAssets";
import { preloadAsset } from "../infrastructure/assetPipeline";

/**
 * Resolves the asset for (state, expression), preloads it, and only swaps it
 * in once ready — so switching state never flashes a half-loaded image. Until
 * the new asset is ready, the previous (or fallback) asset stays on screen.
 */
export function useCharacterAsset(
  state: CharacterState,
  expression: CharacterExpression,
): CharacterAsset {
  const asset = resolveAsset(state, expression);
  const [displayAsset, setDisplayAsset] = useState<CharacterAsset>(FALLBACK_ASSET);

  useEffect(() => {
    let cancelled = false;
    preloadAsset(asset).then(() => {
      if (!cancelled) setDisplayAsset(asset);
    });
    return () => {
      cancelled = true;
    };
  }, [asset]);

  return displayAsset;
}
