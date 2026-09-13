import type { SequenceAsset, VideoAsset } from "../types/asset";
import type {
  CharacterActionDefinition,
  ResolvedActionKind,
  ResolvedCharacterAction,
} from "../types/action";
import { validateSequence } from "./characterAssets";

/**
 * PNG-sequence registry for character actions. Real sequence assets may be
 * added later, e.g.:
 *
 *   "seq.wave": { type: "sequence", frames: [wave0, wave1, wave2], fps: 12 },
 *
 * An action whose assetId has no valid registry entry is unavailable: the
 * menu shows it disabled and play() refuses — it never throws.
 */
export const ACTION_SEQUENCES: Record<string, SequenceAsset> = {
  // ——— registry: real sequences land here ———
  // "seq.wave": { type: "sequence", frames: [...], fps: 12 },
};

/**
 * Video registry for character actions. Each entry points at a file inside
 * JaneActions/ (no extension). Transparent WebM (VP9 + alpha) is preferred;
 * MP4 resolves as fallback but has NO alpha channel (black background).
 */
export interface ActionVideoSpec {
  /** File basename inside JaneActions/ (without extension). */
  file: string;
  loop: boolean;
  muted: boolean;
  playbackRate?: number;
  /** Per-action alignment vs the base Jane render (calibratable in Debug). */
  scale: number;
  offsetX: number;
  offsetY: number;
}

export const ACTION_VIDEOS: Record<string, ActionVideoSpec> = {
  "vid.heart": { file: "比心", loop: false, muted: true, scale: 1, offsetX: 0, offsetY: 0 },
  "vid.adjustGlasses": { file: "扶个眼镜", loop: false, muted: true, scale: 1, offsetX: 0, offsetY: 0 },
  "vid.catAngry": { file: "小猫生气", loop: false, muted: true, scale: 1, offsetX: 0, offsetY: 0 },
  "vid.catPeek": { file: "小猫探头", loop: false, muted: true, scale: 1, offsetX: 0, offsetY: 0 },
  "vid.smile": { file: "笑一下", loop: false, muted: true, scale: 1, offsetX: 0, offsetY: 0 },
  "vid.trexCute": { file: "霸王龙卖萌", loop: false, muted: true, scale: 1, offsetX: 0, offsetY: 0 },
  "vid.catConfused": { file: "小猫疑惑", loop: false, muted: true, scale: 1, offsetX: 0, offsetY: 0 },
};

/**
 * Build-time scan of JaneActions/*.webm|mp4 (Vite import.meta.glob). Outside
 * Vite (node test runner) the call throws and the registry stays empty —
 * tests register URLs via {@link registerActionVideoUrl}.
 */
function scanActionVideoFiles(): Record<string, string> {
  try {
    const raw = import.meta.glob("../../JaneActions/*.{webm,mp4}", {
      eager: true,
      import: "default",
    }) as Record<string, string>;
    const byBase: Record<string, string> = {};
    // Two passes so .webm (real alpha) wins over .mp4 for the same basename.
    for (const ext of [".webm", ".mp4"]) {
      for (const [path, url] of Object.entries(raw)) {
        if (!path.toLowerCase().endsWith(ext)) continue;
        const filename = path.split("/").pop() ?? path;
        const base = filename.slice(0, -ext.length);
        if (!byBase[base]) byBase[base] = url;
      }
    }
    return byBase;
  } catch {
    return {};
  }
}

const ACTION_VIDEO_URLS: Record<string, string> = scanActionVideoFiles();

/** Test / tooling hook: register the resolved URL for a video basename. */
export function registerActionVideoUrl(file: string, url: string): void {
  ACTION_VIDEO_URLS[file] = url;
}

/**
 * Real, locally-produced action videos (webm where available). Definitions
 * appear in the 动作 menu; entries without a playable asset show disabled.
 */
export const CHARACTER_ACTIONS: CharacterActionDefinition[] = [
  { id: "heart", label: "比个心", assetId: "vid.heart", loop: false, interruptible: true, enabled: true, order: 1 },
  { id: "adjustGlasses", label: "扶眼镜", assetId: "vid.adjustGlasses", loop: false, interruptible: true, enabled: true, order: 2 },
  { id: "catAngry", label: "小猫生气", assetId: "vid.catAngry", loop: false, interruptible: true, enabled: true, order: 3 },
  { id: "catPeek", label: "小猫探头", assetId: "vid.catPeek", loop: false, interruptible: true, enabled: true, order: 4 },
  { id: "smile", label: "笑一下", assetId: "vid.smile", loop: false, interruptible: true, enabled: true, order: 5 },
  { id: "trexCute", label: "霸王龙卖萌", assetId: "vid.trexCute", loop: false, interruptible: true, enabled: true, order: 6 },
  { id: "catConfused", label: "小猫疑惑", assetId: "vid.catConfused", loop: false, interruptible: true, enabled: true, order: 7 },
];

export function getActionDef(id: string): CharacterActionDefinition | undefined {
  return CHARACTER_ACTIONS.find((a) => a.id === id);
}

/** Resolve a definition to a playable asset, or null when unavailable. */
export function resolveAction(def: CharacterActionDefinition): ResolvedCharacterAction | null {
  if (!def.enabled) return null;
  const sequence = ACTION_SEQUENCES[def.assetId];
  if (sequence && validateSequence(sequence)) {
    return { def, asset: sequence, kind: "sequence" };
  }
  const spec = ACTION_VIDEOS[def.assetId];
  const src = spec ? ACTION_VIDEO_URLS[spec.file] : undefined;
  if (spec && src) {
    const asset: VideoAsset = {
      type: "video",
      src,
      loop: spec.loop,
      muted: spec.muted,
      playbackRate: spec.playbackRate,
    };
    return { def, asset, kind: "video" };
  }
  return null;
}

export interface ActionGateContext {
  /** Focus session active — entertainment actions are blocked by default. */
  focus: boolean;
}

/**
 * Pure priority gating. User actions beat scheduled behaviors, but a focus
 * session restricts entertainment actions:
 *   focus  → all entertainment actions blocked (default policy)
 *   normal → everything enabled
 */
export function isActionAllowed(
  _def: CharacterActionDefinition,
  ctx: ActionGateContext,
): boolean {
  if (ctx.focus) return false;
  return true;
}

export interface ActionMenuItem {
  def: CharacterActionDefinition;
  /** Has a playable asset AND allowed in the current context. */
  available: boolean;
  hasAsset: boolean;
}

/** Build the 动作 menu entries, sorted by order. Pure — never throws. */
export function actionMenuItems(ctx: ActionGateContext): ActionMenuItem[] {
  return [...CHARACTER_ACTIONS]
    .filter((d) => d.enabled)
    .sort((a, b) => (a.order ?? 99) - (b.order ?? 99))
    .map((def) => ({
      def,
      hasAsset: resolveAction(def) !== null,
      available: resolveAction(def) !== null && isActionAllowed(def, ctx),
    }));
}

/** The video spec backing a definition, if any. */
export function getActionVideoSpec(
  actionId: string,
): ActionVideoSpec | undefined {
  const def = getActionDef(actionId);
  return def ? ACTION_VIDEOS[def.assetId] : undefined;
}

/** All enabled action ids that resolve to a video asset. */
export function videoActionIds(): string[] {
  return CHARACTER_ACTIONS.filter(
    (d) => d.enabled && resolveAction(d)?.kind === ("video" satisfies ResolvedActionKind),
  ).map((d) => d.id);
}
