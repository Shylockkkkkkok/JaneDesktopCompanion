/**
 * Central dialogue configuration. No magic numbers in the selector/engine.
 * Times are in milliseconds unless noted.
 */
export const DIALOGUE_CONFIG = {
  // Rarity → weight (higher = more likely to be picked).
  weights: { common: 10, uncommon: 4, rare: 1 },

  // Recent-line dedup window: lines in this many recent entries are excluded.
  recentMax: 8,

  // Tone continuity: avoid repeating a tone that appeared in the last N picks.
  toneRecentMax: 2,

  // Per-category cooldown. 0 = user-triggered, no cooldown (bubble duration
  // + frequency gating already limit these).
  cooldownMs: {
    "interaction.hover": 0,
    "interaction.click": 0,
    "interaction.rapidClick.medium": 0,
    "interaction.rapidClick.high": 0,
    "interaction.rapidClick.rare": 0,

    "idle.general": 20 * 60_000, // 20 min

    "time.morning": 40 * 60_000,
    "time.afternoon": 40 * 60_000,
    "time.evening": 40 * 60_000,
    "time.lateNight": 70 * 60_000,
    "time.deepNight.rare": 120 * 60_000,

    "activity.return.short": 30 * 60_000,
    "activity.return.long": 30 * 60_000,
    "activity.longWork": 45 * 60_000,

    "focus.start": 0,
    "focus.activeClick": 0,
    "focus.complete": 0,

    "goals.completeOne": 0,
    "goals.completeAll": 0,

    "timeline.recordAdded": 0,

    "rare.general": 3 * 60 * 60_000, // 3 hours
    "jane.meeting": 6 * 60 * 60_000, // 6 hours

    "concert.countdown30": 6 * 60 * 60_000, // 6 hours
    "concert.countdown7": 6 * 60 * 60_000,
    "concert.countdown3": 6 * 60 * 60_000,
    "concert.tomorrow": 6 * 60 * 60_000,
    "concert.today": 6 * 60 * 60_000,
  },
} as const;

/** Categories that must stay silent during an active Focus session. */
export const FOCUS_SUPPRESSED_CATEGORIES: readonly string[] = [
  "idle.general",
  "time.morning",
  "time.afternoon",
  "time.evening",
  "time.lateNight",
  "time.deepNight.rare",
  "activity.return.short",
  "activity.return.long",
  "activity.longWork",
  "rare.general",
  "jane.meeting",
  "concert.countdown30",
  "concert.countdown7",
  "concert.countdown3",
  "concert.tomorrow",
  "concert.today",
];

/**
 * Proactive dialogue (BehaviorScheduler-driven) tuning. Cooldowns per pool
 * live in {@link DIALOGUE_CONFIG.cooldownMs} — these constants only decide
 * ELIGIBILITY and chance, never schedule a line by themselves.
 */
export const PROACTIVE_CONFIG = {
  /** Away ≥ this → the short-return pool becomes eligible ("回来了"). */
  returnShortAfterMs: 5 * 60_000,
  /** Away ≥ this → the long-return pool instead of short. */
  returnLongAfterMs: 30 * 60_000,
  /** Chance that a return transition produces a line at all (20–30%). */
  returnChance: 0.25,
  /** Continuous active work before the long-work nudge is eligible. */
  longWorkAfterMs: 75 * 60_000,
  /** System idle ≥ this counts as a real break → the work session resets. */
  longWorkBreakResetMs: 5 * 60_000,
  /** Chance the long-work nudge actually speaks when eligible. */
  longWorkChance: 0.35,
  /** Max per-sample delta credited to continuous work (suspended-tab guard). */
  maxSampleDeltaMs: 60_000,
  /** TimeContext "night" hours 23:00–01:59 → the lateNight pool. */
  lateNightHours: [23, 0, 1],
  /** TimeContext "night" hours 02:00–04:59 → the deepNight.rare pool. */
  deepNightHours: [2, 3, 4],
} as const;
