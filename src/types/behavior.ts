import type { IdleMotion } from "./character";
import type { ConcertContext } from "./concert";

export type TimeOfDay = "morning" | "afternoon" | "evening" | "night";

export interface TimeContext {
  now: Date;
  hour: number;
  timeOfDay: TimeOfDay;
}

/** Coarse user presence — never what app/content the user is using. */
export type UserActivityState = "active" | "temporarilyAway" | "longAway";

export type BehaviorKind = "idleMotion" | "idleSpeak" | "concert";

/** Preemption level for future use (higher preempts lower). */
export type BehaviorPriority = "low" | "normal" | "high";

export interface BehaviorEvent {
  kind: BehaviorKind;
  /** Set for idleMotion — which idle animation to play. */
  motion?: IdleMotion;
  /** Set for idleMotion — how long to hold the animation. */
  durationMs?: number;
}

/** Context passed to a behavior's eligibility check. */
export interface BehaviorCondition {
  time: TimeContext;
  activity: UserActivityState;
  concert: ConcertContext;
}

/** Context passed to dialogue line selection (extendable later). */
export interface DialogueContext {
  timeOfDay: TimeOfDay;
  activity: UserActivityState;
  /** Number of saved timeline records (gates e.g. "原来已经见过这么多次了！"). */
  timelineCount?: number;
}
