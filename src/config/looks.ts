import type { CharacterPose } from "../types/photoAsset";

/**
 * Look categories = the five poses from the Debug Panel, nothing else.
 * Each asset belongs to exactly one pose category; lookId mirrors the
 * category (kept as a separate field for future outfit subdivision).
 *
 *   standing 站姿 · sitting 坐姿 · relaxed 放松 · focus 专注 · concert 演出
 */
export const POSE_TABS: { id: CharacterPose; label: string }[] = [
  { id: "standing", label: "站姿" },
  { id: "sitting", label: "坐姿" },
  { id: "relaxed", label: "放松" },
  { id: "focus", label: "专注" },
  { id: "concert", label: "演出" },
];

export const POSE_LABELS: Record<CharacterPose, string> = {
  standing: "站姿",
  sitting: "坐姿",
  relaxed: "放松",
  focus: "专注",
  concert: "演出",
};

/** lookId mirrors the category (one look per pose for now). */
export const POSE_TO_LOOK: Record<CharacterPose, CharacterPose> = {
  standing: "standing",
  sitting: "sitting",
  relaxed: "relaxed",
  focus: "focus",
  concert: "concert",
};

/** Poses that count as "normal Jane" — the pool "换一个" rotates through. */
export const NORMAL_POSES: CharacterPose[] = ["standing", "relaxed", "sitting"];

/** Startup look mode (settings field, default keepLast). */
export type StartupLookMode = "keepLast" | "randomFavorite" | "randomDaily";

export const STARTUP_LOOK_MODES: { id: StartupLookMode; label: string }[] = [
  { id: "keepLast", label: "保持上次" },
  { id: "randomDaily", label: "随机站姿" },
];

/** Minimal asset facts the pure look helpers need (keeps them testable). */
export interface LookAssetInfo {
  id: string;
  category: CharacterPose;
  lookId: string;
  enabled: boolean;
}

function pickRandom(pool: LookAssetInfo[]): string | null {
  if (pool.length === 0) return null;
  return pool[Math.floor(Math.random() * pool.length)].id;
}

/**
 * Pure: resolve the asset to show at startup. Returns null for keepLast
 * (caller keeps whatever was persisted). Invalid favorites (disabled /
 * missing) are skipped — startup must never fail because of a bad id.
 */
export function resolveStartupAsset(
  mode: StartupLookMode,
  assets: LookAssetInfo[],
  favoriteIds: string[],
): string | null {
  if (mode === "keepLast") return null;
  const enabled = assets.filter((a) => a.enabled);
  const primary =
    mode === "randomFavorite"
      ? enabled.filter((a) => favoriteIds.includes(a.id))
      : enabled.filter((a) => a.category === "standing");
  // Fallback chain: normal poses → anything enabled. Never throws.
  const secondary = enabled.filter((a) => NORMAL_POSES.includes(a.category));
  return pickRandom(primary) ?? pickRandom(secondary) ?? pickRandom(enabled);
}

/**
 * Pure: pick a different asset from the normal pool ("换一个"). The current
 * asset is always excluded; returns null when there is nothing else enabled.
 */
export function pickAnotherAsset(
  currentId: string | null,
  assets: LookAssetInfo[],
): string | null {
  const pool = assets.filter(
    (a) => a.enabled && NORMAL_POSES.includes(a.category) && a.id !== currentId,
  );
  return pickRandom(pool);
}

/**
 * Pure: pick a random enabled asset of one pose category ("随机出一张图").
 * Returns null when the category has no enabled assets.
 */
export function pickRandomOfPose(
  pose: CharacterPose,
  assets: LookAssetInfo[],
): string | null {
  return pickRandom(assets.filter((a) => a.enabled && a.category === pose));
}

/**
 * Pure: validate a base asset id. Returns the id when the asset exists and is
 * enabled, else null (caller falls back).
 */
export function validBaseAsset(
  assetId: string | null,
  assets: LookAssetInfo[],
): string | null {
  if (!assetId) return null;
  const asset = assets.find((a) => a.id === assetId);
  return asset && asset.enabled ? asset.id : null;
}
