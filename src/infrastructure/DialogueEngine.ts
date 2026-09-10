import type { DialogueEntry, DialogueTone } from "../types/dialogue";
import type { DialogueContext } from "../types/behavior";
import { getDialogueEntries } from "../data/dialogues";
import {
  DIALOGUE_CONFIG,
  FOCUS_SUPPRESSED_CATEGORIES,
} from "../config/dialogue";
import { timeContext } from "./TimeContext";
import { userActivity } from "./UserActivityContext";
import { focusSession } from "./FocusSession";
import { timelineStore } from "./TimelineStore";

export interface PickedDialogue {
  id: string;
  text: string;
  tone: DialogueTone;
  weight: number;
  category: string;
}

const RAPID_KEY = {
  2: "interaction.rapidClick.medium",
  3: "interaction.rapidClick.high",
  4: "interaction.rapidClick.rare",
} as const;

/**
 * Stateful dialogue selector. Resolves a semantic key to a line with:
 *   - focus suppression (ordinary proactive categories stay silent in focus)
 *   - per-category cooldown
 *   - recent-line dedup (recentDialogueIds)
 *   - tone continuity (avoid repeating the last N tones)
 *   - weighted-random selection
 *
 * The caller (useDialogue / App) still owns the bubble UI and gating.
 */
export class DialogueEngine {
  private recentIds: string[] = [];
  private recentTones: DialogueTone[] = [];
  private lastTriggeredAt = new Map<string, number>();
  private lastPicked: PickedDialogue | null = null;

  /** Main API: resolve a key to a line, or null when suppressed/cooling down. */
  request(key: string, ctx?: DialogueContext): string | null {
    // Focus suppression.
    if (focusSession.isActive() && FOCUS_SUPPRESSED_CATEGORIES.includes(key)) {
      return null;
    }

    // Cooldown.
    const cooldown = this.cooldownOf(key);
    const last = this.lastTriggeredAt.get(key) ?? 0;
    if (cooldown > 0 && Date.now() - last < cooldown) return null;

    const entries = getDialogueEntries(key);
    if (!entries || entries.length === 0) return null;

    // Context filter. Entries carrying an explicit `when` were excluded on
    // purpose �?they must never be reintroduced by the empty-pool fallback.
    let base = entries;
    if (ctx) {
      base = entries.filter((e) => !e.when || e.when(ctx));
      if (base.length === 0 && !entries.some((e) => e.when)) base = entries;
    }

    // Recent-line dedup (relax to the full pool if everything is recent).
    let pool = base.filter((e) => !this.recentIds.includes(e.id));
    if (pool.length === 0) pool = base;

    // Tone continuity (relax if filtering empties the pool).
    const tonePool = pool.filter((e) => !this.recentTones.includes(e.tone ?? "neutral"));
    if (tonePool.length > 0) pool = tonePool;

    const entry = this.weightedPick(pool);

    this.record(key, entry);

    return entry.text;
  }

  // ── convenience (used by useDialogue) ───────────────────

  /** Current dialogue context, including derived timeline state. */
  getContext(): DialogueContext {
    return {
      timeOfDay: timeContext.get().timeOfDay,
      activity: userActivity.getState(),
      timelineCount: timelineStore.getCount(),
    };
  }

  pickHover(): string | null {
    return this.request("interaction.hover", this.getContext());
  }

  pickClick(): string | null {
    return this.request("interaction.click", this.getContext());
  }

  pickIdle(): string | null {
    return this.request("idle.general", this.getContext());
  }

  pickRapid(level: 2 | 3 | 4): string | null {
    return this.request(RAPID_KEY[level], this.getContext());
  }

  // ── debug ───────────────────────────────────────────────

  getLastPicked(): PickedDialogue | null {
    return this.lastPicked;
  }

  getRecentIds(): string[] {
    return [...this.recentIds];
  }

  getRecentTones(): DialogueTone[] {
    return [...this.recentTones];
  }

  getCooldownRemaining(key: string): number {
    const cooldown = this.cooldownOf(key);
    const last = this.lastTriggeredAt.get(key) ?? 0;
    return Math.max(0, cooldown - (Date.now() - last));
  }

  getEntries(key: string): DialogueEntry[] {
    return getDialogueEntries(key) ?? [];
  }

  resetCooldowns(): void {
    this.lastTriggeredAt.clear();
  }

  clearRecent(): void {
    this.recentIds = [];
    this.recentTones = [];
  }

  // ── internals ───────────────────────────────────────────

  private cooldownOf(key: string): number {
    const map = DIALOGUE_CONFIG.cooldownMs as Record<string, number>;
    return map[key] ?? 0;
  }

  private weightedPick(pool: DialogueEntry[]): DialogueEntry {
    const total = pool.reduce((s, e) => s + (e.weight > 0 ? e.weight : 1), 0);
    let r = Math.random() * total;
    for (const e of pool) {
      r -= e.weight > 0 ? e.weight : 1;
      if (r <= 0) return e;
    }
    return pool[pool.length - 1];
  }

  private record(key: string, entry: DialogueEntry): void {
    this.lastPicked = {
      id: entry.id,
      text: entry.text,
      tone: entry.tone ?? "neutral",
      weight: entry.weight,
      category: key,
    };

    this.recentIds.push(entry.id);
    if (this.recentIds.length > DIALOGUE_CONFIG.recentMax) this.recentIds.shift();

    this.recentTones.push(entry.tone ?? "neutral");
    if (this.recentTones.length > DIALOGUE_CONFIG.toneRecentMax) this.recentTones.shift();

    this.lastTriggeredAt.set(key, Date.now());
  }
}

export const dialogueEngine = new DialogueEngine();

