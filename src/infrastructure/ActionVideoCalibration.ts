import type { ActionVideoSpec } from "../config/characterActions";

const STORAGE_KEY = "jane.action-video-cal.v1";

export interface VideoActionCalibration {
  scale: number;
  offsetX: number;
  offsetY: number;
}

type Overrides = Record<string, Partial<VideoActionCalibration>>;

/**
 * Per-action video alignment overrides (scale / offsetX / offsetY), edited
 * live in the Debug panel and persisted to localStorage. Keyed by action id;
 * falls back to the spec defaults in ACTION_VIDEOS.
 */
class ActionVideoCalibrationStore {
  private overrides: Overrides;
  private listeners = new Set<() => void>();
  private version = 0;

  constructor() {
    this.overrides = this.load();
  }

  /** Effective calibration for an action (overrides merged over defaults). */
  get(actionId: string, defaults: VideoActionCalibration): VideoActionCalibration {
    const o = this.overrides[actionId];
    return {
      scale: o?.scale ?? defaults.scale,
      offsetX: o?.offsetX ?? defaults.offsetX,
      offsetY: o?.offsetY ?? defaults.offsetY,
    };
  }

  set(actionId: string, patch: Partial<VideoActionCalibration>): void {
    const next = { ...this.overrides[actionId], ...patch };
    this.overrides[actionId] = next;
    this.save();
    this.version += 1;
    this.notify();
  }

  reset(actionId: string): void {
    delete this.overrides[actionId];
    this.save();
    this.version += 1;
    this.notify();
  }

  getVersion(): number {
    return this.version;
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

  private load(): Overrides {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}");
    } catch {
      return {};
    }
  }

  private save(): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.overrides));
    } catch {
      /* non-fatal: calibration just won't persist */
    }
  }
}

export const actionVideoCalibration = new ActionVideoCalibrationStore();

/** Default calibration derived from an action's video spec. */
export function calibrationDefaults(
  spec: Pick<ActionVideoSpec, "scale" | "offsetX" | "offsetY">,
): VideoActionCalibration {
  return { scale: spec.scale, offsetX: spec.offsetX, offsetY: spec.offsetY };
}
