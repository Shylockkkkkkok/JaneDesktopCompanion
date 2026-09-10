import type { DialogueContext } from "./behavior";

export type DialogueTone =
  | "neutral"
  | "gentle"
  | "teasing"
  | "concerned"
  | "focused"
  | "rare";

export type DialogueRarity = "common" | "uncommon" | "rare";

/**
 * Unified dialogue entry. Lines are data, never hard-coded into components or
 * session logic — so the vocabulary can grow without touching business code.
 */
export interface DialogueEntry {
  id: string;
  text: string;
  /** Selection weight (higher = more likely). */
  weight: number;
  /** Metadata for the selector / future expression. Not an expression driver. */
  tone?: DialogueTone;
  /** Optional per-line cooldown override. */
  cooldownMs?: number;
  /** Reserved for future tagging / filtering. */
  tags?: string[];
  /** Optional context condition (keeps context-aware selection). */
  when?: (ctx: DialogueContext) => boolean;
}

/** Compact constructor for dialogue data files. */
export function dlg(
  id: string,
  text: string,
  weight: number,
  tone: DialogueTone = "neutral",
  extra?: Partial<Pick<DialogueEntry, "when" | "cooldownMs" | "tags">>,
): DialogueEntry {
  return { id, text, weight, tone, ...extra };
}
