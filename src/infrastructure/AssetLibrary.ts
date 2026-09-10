import type { CharacterPose, PhotoAssetMeta } from "../types/photoAsset";
import { POSE_TO_LOOK } from "../config/looks";

const STORAGE_KEY = "jane.photo-assets.v1";
/**
 * One-time migration flag: the first category guesses were wrong
 * (s/b/st/fa/c/f were misread). When this flag is absent, stored
 * category/lookId overrides are discarded (visual tuning like scale/offset
 * is kept) and recomputed from the corrected guess. Missing/partial legacy
 * data stays fully compatible.
 */
const MIGRATION_KEY = "jane.photo-assets.migrated-categories-v3";

// Dynamically scan every PNG under Jane_pics/ at build time.
const raw = import.meta.glob("../../Jane_pics/*.png", {
  eager: true,
  import: "default",
}) as Record<string, string>;

type PhotoOverride = Partial<Omit<PhotoAssetMeta, "id" | "src">>;

/**
 * Category from the source filename prefix. Verified against the actual
 * photos:
 *   b*   全身站姿写真     → standing (日常)
 *   s*   坐姿             → sitting  (坐姿)
 *   st*  舞台礼服演出     → concert  (舞台)
 *   fa*  演唱会现场       → concert  (舞台)
 *   c*   运动/生活场景    → relaxed  (休闲)
 *   f*   特写自拍         → focus    (特殊)
 * ("st" must be tested before "s"; the placeholder is matched explicitly.)
 */
function guessCategory(id: string): CharacterPose {
  if (id === "character-placeholder") return "standing";
  if (id.startsWith("st")) return "concert";
  if (id.startsWith("s")) return "sitting";
  if (id.startsWith("b")) return "standing";
  if (id.startsWith("c")) return "relaxed";
  if (id.startsWith("f")) return "focus";
  return "standing";
}

function buildInitial(): PhotoAssetMeta[] {
  return Object.entries(raw)
    .map(([path, url]) => {
      const filename = path.split("/").pop() ?? path;
      const id = filename.replace(/\.png$/, "");
      const category = guessCategory(id);
      return {
        id,
        src: url,
        category,
        // Business look derived from the pose (daily/casual/sitting/stage/special).
        lookId: POSE_TO_LOOK[category],
        scale: 1,
        offsetX: 0,
        offsetY: 0,
        weight: 1,
        enabled: true,
      };
    })
    .sort((a, b) => a.id.localeCompare(b.id));
}

/**
 * Runtime photo library. Scans Jane_pics/ at build time, merges persisted
 * overrides (localStorage) and exposes the unified metadata. The Asset Lab
 * edits metadata through `update`, which persists immediately.
 */
class AssetLibrary {
  private assets: PhotoAssetMeta[];
  private listeners = new Set<() => void>();

  constructor() {
    const overrides = this.loadOverrides();
    // One-time migration: the first category guesses were wrong, and every
    // override persists category/lookId — so the wrong values would shadow
    // the corrected guess forever. Strip them once (keeping scale/offset/
    // weight/enabled tuning) and let the corrected guess re-derive them.
    if (!localStorage.getItem(MIGRATION_KEY)) {
      for (const key of Object.keys(overrides)) {
        delete overrides[key].category;
        delete overrides[key].lookId;
      }
      try {
        localStorage.setItem(MIGRATION_KEY, "1");
      } catch {
        /* non-fatal: migration just re-runs next launch */
      }
    }
    this.assets = buildInitial().map((a) => ({ ...a, ...overrides[a.id] }));
  }

  getAll(): PhotoAssetMeta[] {
    return this.assets;
  }

  getById(id: string): PhotoAssetMeta | undefined {
    return this.assets.find((a) => a.id === id);
  }

  getEnabled(category: CharacterPose, lookId: string): PhotoAssetMeta[] {
    return this.assets.filter(
      (a) => a.enabled && a.category === category && a.lookId === lookId,
    );
  }

  hasEnabled(category: CharacterPose, lookId?: string): boolean {
    return this.assets.some(
      (a) =>
        a.enabled && a.category === category && (!lookId || a.lookId === lookId),
    );
  }

  update(id: string, patch: PhotoOverride): void {
    const asset = this.assets.find((a) => a.id === id);
    if (!asset) return;
    Object.assign(asset, patch);
    this.saveOverrides();
    this.notify();
  }

  subscribe(fn: () => void): () => void {
    this.listeners.add(fn);
    return () => {
      this.listeners.delete(fn);
    };
  }

  private notify(): void {
    for (const fn of this.listeners) fn();
  }

  private loadOverrides(): Record<string, PhotoOverride> {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}");
    } catch {
      return {};
    }
  }

  private saveOverrides(): void {
    const overrides: Record<string, PhotoOverride> = {};
    for (const a of this.assets) {
      overrides[a.id] = {
        category: a.category,
        lookId: a.lookId,
        scale: a.scale,
        offsetX: a.offsetX,
        offsetY: a.offsetY,
        weight: a.weight,
        enabled: a.enabled,
      };
    }
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(overrides));
    } catch {
      /* non-fatal: overrides just won't persist */
    }
  }
}

export const assetLibrary = new AssetLibrary();
