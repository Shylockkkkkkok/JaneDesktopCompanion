import type { CharacterAsset } from "../types/asset";

/** Loaded-image cache + in-flight dedupe so repeated assets load once. */
const imageCache = new Map<string, HTMLImageElement>();
const pending = new Map<string, Promise<HTMLImageElement>>();

function loadImage(src: string): Promise<HTMLImageElement> {
  const cached = imageCache.get(src);
  if (cached && cached.complete) return Promise.resolve(cached);

  const existing = pending.get(src);
  if (existing) return existing;

  const promise = new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      imageCache.set(src, img);
      pending.delete(src);
      resolve(img);
    };
    img.onerror = () => {
      pending.delete(src);
      reject(new Error(`failed to load image: ${src}`));
    };
    img.src = src;
  });
  pending.set(src, promise);
  return promise;
}

/** Preload all frames / the single image. Non-fatal on failure. */
export async function preloadAsset(asset: CharacterAsset): Promise<void> {
  try {
    if (asset.type === "sequence") {
      await Promise.all(asset.frames.map(loadImage));
    } else {
      await loadImage(asset.src);
    }
  } catch {
    // The renderer falls back on load failure.
  }
}

/** True when the asset is fully loaded and ready to paint (no flash). */
export function isAssetReady(asset: CharacterAsset): boolean {
  if (asset.type === "sequence") {
    return asset.frames.every((f) => imageCache.get(f)?.complete === true);
  }
  return imageCache.get(asset.src)?.complete === true;
}
