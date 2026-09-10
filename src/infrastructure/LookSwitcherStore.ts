import type { StartupLookMode } from "../config/looks";
import { resolveStartupAsset, validBaseAsset } from "../config/looks";
import type { LookAssetInfo } from "../config/looks";

const STORAGE_KEY = "jane.look.v1";

interface LookState {
  /** The user's chosen base asset (or null = auto-pick per pose/look). */
  baseAssetId: string | null;
  /** When locked, normal behavior never swaps the base asset. */
  locked: boolean;
  favoriteAssetIds: string[];
}

const DEFAULT_STATE: LookState = {
  baseAssetId: null,
  locked: false,
  favoriteAssetIds: [],
};

/**
 * Local-only look-switcher state (base asset / lock / favorites). Pure data +
 * persistence; pool logic lives in config/looks.ts so it stays testable.
 *
 * Note the base/override split: this store holds the BASE asset. Focus and
 * Concert temporarily override the displayed asset elsewhere (App wiring) and
 * restore to this base when they end — special states never overwrite it.
 */
class LookSwitcherStore {
  private state: LookState;
  private listeners = new Set<() => void>();

  constructor() {
    this.state = this.load();
  }

  getBaseAssetId(): string | null {
    return this.state.baseAssetId;
  }

  setBaseAsset(id: string | null): void {
    this.state.baseAssetId = id;
    this.save();
    this.notify();
  }

  isLocked(): boolean {
    return this.state.locked;
  }

  setLocked(locked: boolean): void {
    this.state.locked = locked;
    this.save();
    this.notify();
  }

  getFavorites(): string[] {
    return [...this.state.favoriteAssetIds];
  }

  isFavorite(assetId: string): boolean {
    return this.state.favoriteAssetIds.includes(assetId);
  }

  /** Toggle favorite; returns the new favorite state of the asset. */
  toggleFavorite(assetId: string): boolean {
    const favs = this.state.favoriteAssetIds;
    const idx = favs.indexOf(assetId);
    if (idx >= 0) favs.splice(idx, 1);
    else favs.push(assetId);
    this.save();
    this.notify();
    return idx < 0;
  }

  /**
   * Apply the startup look mode. `assets` is the full library snapshot.
   * keepLast validates the persisted base asset; invalid ids fall back to
   * null (auto-pick) instead of failing. randomFavorite/randomDaily always
   * set a fresh (possibly different) base. Returns the effective asset id.
   */
  applyStartup(
    mode: StartupLookMode,
    assets: LookAssetInfo[],
  ): string | null {
    if (mode === "keepLast") {
      const valid = validBaseAsset(this.state.baseAssetId, assets);
      this.state.baseAssetId = valid;
      this.save();
      this.notify();
      return valid;
    }
    const id = resolveStartupAsset(mode, assets, this.state.favoriteAssetIds);
    this.state.baseAssetId = id;
    this.save();
    this.notify();
    return id;
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

  private load(): LookState {
    try {
      const parsed: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "null");
      if (parsed && typeof parsed === "object") {
        const raw = parsed as Partial<LookState>;
        return {
          baseAssetId: typeof raw.baseAssetId === "string" ? raw.baseAssetId : null,
          locked: raw.locked === true,
          favoriteAssetIds: Array.isArray(raw.favoriteAssetIds)
            ? raw.favoriteAssetIds.filter((x): x is string => typeof x === "string")
            : [],
        };
      }
    } catch {
      /* fall through to defaults */
    }
    return { ...DEFAULT_STATE };
  }

  private save(): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.state));
    } catch {
      /* non-fatal */
    }
  }
}

export const lookSwitcher = new LookSwitcherStore();
