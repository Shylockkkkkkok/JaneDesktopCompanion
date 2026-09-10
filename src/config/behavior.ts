import type {
  BehaviorCondition,
  BehaviorKind,
  BehaviorPriority,
} from "../types/behavior";
import type { IdleMotion } from "../types/character";

/** Time-of-day boundaries (24-hour). */
export const TIME_CONFIG = {
  morningStart: 5,
  afternoonStart: 12,
  eveningStart: 18,
  nightStart: 23,
} as const;

/** User-activity thresholds and polling cadence. */
export const ACTIVITY_CONFIG = {
  // Idle seconds before "temporarily away".
  temporarilyAwayAfterSec: 60,
  // Idle seconds before "long away".
  longAwayAfterSec: 300,
  // How often to poll the system idle time.
  pollIntervalMs: 5000,
} as const;

export const SCHEDULER_CONFIG = {
  // Min/max delay between scheduler "ticks" (deciding whether to act).
  tickIntervalMinMs: 8000,
  tickIntervalMaxMs: 20000,
  // Chance to do nothing on a tick (keeps Jane low-disturbance).
  skipChance: 0.4,
} as const;

/**
 * Global interaction priority — higher preempts lower.
 * User-initiated actions always beat automatic scheduled behaviors.
 */
export const INTERACTION_PRIORITY = {
  drag: 5,
  reaction: 4,
  hover: 3,
  scheduled: 2,
  idle: 1,
} as const;

export interface BehaviorDefinition {
  kind: BehaviorKind;
  priority: BehaviorPriority;
  /** Minimum gap before this behavior can run again. */
  cooldownMs: number;
  /** Weighted-random selection weight. */
  weight: number;
  canRun: (ctx: BehaviorCondition) => boolean;
}

export const BEHAVIORS: readonly BehaviorDefinition[] = [
  {
    kind: "idleMotion",
    priority: "low",
    // Short cooldown — animations are frequent (higher than speech).
    cooldownMs: 8000,
    weight: 3,
    canRun: () => true,
  },
  {
    kind: "idleSpeak",
    priority: "normal",
    // Long cooldown — active speech is deliberately rare.
    cooldownMs: 45000,
    weight: 1,
    // Don't speak to an empty room.
    canRun: ({ activity }) => activity !== "longAway",
  },
  {
    kind: "concert",
    priority: "low",
    // Very long cooldown — concert reminders must be rare.
    cooldownMs: 6 * 60 * 60_000, // 6 hours
    weight: 1,
    canRun: ({ concert }) => concert !== "normal",
  },
];

export const IDLE_MOTIONS: readonly IdleMotion[] = ["breathe", "sway", "tilt"];

export const IDLE_MOTION_DURATION = { minMs: 500, maxMs: 2000 } as const;
