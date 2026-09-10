/**
 * Core character + settings types.
 *
 * `CharacterState` and `CharacterExpression` are intentionally wider than what
 * V0.1.5 implements — most variants are reserved for future expansion.
 *
 * `State` (long-lived posture) and `Expression` (facial mood) are separate
 * axes and combine freely (e.g. `sitting` + `question`). `Reaction` is a
 * transient event layered on top of the base state.
 */
export type CharacterState =
  | "idle"
  | "hover"
  | "reaction"
  | "sitting"
  | "focus"
  | "tired"
  | "sleep"
  | "concert";

export type CharacterExpression =
  | "neutral"
  | "softSmile"
  | "question"
  | "slightlyAnnoyed"
  | "tired";

/** Transient event on top of the base state, e.g. a click. */
export type CharacterReaction =
  | "none"
  | "click"
  | "rapidClick"
  | "goalComplete"
  | "allGoalsComplete";

export type DialogueFrequency = "low" | "medium" | "high";

/** Physical pixel coordinates (device space). Size is present on persisted
 * positions from newer versions; 0/absent = keep the current window size. */
export interface Position {
  x: number;
  y: number;
  width?: number;
  height?: number;
}

export interface AppSettings {
  characterPosition: Position | null;
  characterScale: number;
  dialogueFrequency: DialogueFrequency;
  idleAnimationEnabled: boolean;
  passthroughMode: boolean;
  /** Default focus duration in minutes. */
  focusDefaultMinutes: number;
  /** Auto-enter a break after a focus session completes. */
  focusAutoBreak: boolean;
  /** Show the lightweight desktop countdown during focus. */
  focusShowTimer: boolean;
  /** Startup look mode for the character (keepLast by default). */
  startupLookMode: StartupLookMode;
}

/** Low-disturbance idle motions. */
export type IdleMotion = "breathe" | "sway" | "tilt";

export interface IdleState {
  motion: IdleMotion | null;
  nonce: number;
}

/** 0 none, 1 = 1–3 clicks, 2 = 4–6, 3 = 7–10, 4 = 11+ (rare easter egg). */
export type RapidClickLevel = 0 | 1 | 2 | 3 | 4;

/** Which look to show at startup (Look Switcher setting). */
export type StartupLookMode = "keepLast" | "randomFavorite" | "randomDaily";
