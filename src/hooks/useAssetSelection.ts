import { useEffect, useState } from "react";
import type { CharacterPose, PhotoAssetMeta } from "../types/photoAsset";
import { assetLibrary } from "../infrastructure/AssetLibrary";

function weightedPick(assets: PhotoAssetMeta[]): PhotoAssetMeta {
  const total = assets.reduce((sum, a) => sum + a.weight, 0);
  if (total <= 0) return assets[0];
  let r = Math.random() * total;
  for (const a of assets) {
    r -= a.weight;
    if (r <= 0) return a;
  }
  return assets[assets.length - 1];
}

function pick(
  pose: CharacterPose,
  lookId: string,
  preferredId?: string | null,
): PhotoAssetMeta | null {
  if (preferredId) {
    const preferred = assetLibrary.getById(preferredId);
    if (preferred && preferred.enabled && preferred.category === pose) {
      return preferred;
    }
  }
  const exact = assetLibrary.getEnabled(pose, lookId);
  if (exact.length > 0) return weightedPick(exact);

  // Fallback: any enabled asset of this pose (ignore lookId).
  const anyLook = assetLibrary
    .getAll()
    .filter((a) => a.enabled && a.category === pose);
  if (anyLook.length > 0) return weightedPick(anyLook);

  // Final fallback: the placeholder.
  const placeholder = assetLibrary.getById("character-placeholder");
  if (placeholder && placeholder.enabled) return placeholder;

  return null;
}

/**
 * Picks a photo for (pose, lookId) using weights, and keeps it stable — it
 * only re-picks when pose or lookId changes, so idle never randomly swaps the
 * outfit.
 *
 * `preferredId` pins a specific asset (Look Switcher base selection): when the
 * asset exists, is enabled and matches the pose, it is used directly. Any
 * other case (null / disabled / removed / pose mismatch during a special
 * state) falls back to the normal weighted pick.
 */
export function useAssetSelection(
  pose: CharacterPose,
  lookId: string,
  preferredId?: string | null,
): PhotoAssetMeta | null {
  const [selected, setSelected] = useState<PhotoAssetMeta | null>(() =>
    pick(pose, lookId, preferredId),
  );

  useEffect(() => {
    setSelected(pick(pose, lookId, preferredId));
  }, [pose, lookId, preferredId]);

  return selected;
}
