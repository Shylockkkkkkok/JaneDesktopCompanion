import type { TimeOfDay } from "../types/behavior";
import { PROACTIVE_CONFIG } from "../config/dialogue";

/**
 * Proactive dialogue candidate resolution. PURE — no Tauri, no React, no
 * singletons: the BehaviorScheduler tick (or a one-shot activity transition)
 * feeds the current context in and gets an ordered candidate list back.
 *
 * The actual line selection stays in DialogueEngine (focus suppression,
 * per-pool cooldown, recentDialogueIds, tone avoidance, weighted pick); the
 * resolver only decides WHICH pools are eligible and in which order. At most
 * one candidate per cycle is spoken — the caller stops at the first success.
 *
 * Priority (§3 of the proactive-dialogue spec):
 *   activity.return.*  >  activity.longWork  >  time.*  >  idle  >  rare tier
 * (user interaction and focus events live on their own immediate paths and
 * always outrank everything here).
 */

export type ProactiveReason =
  | "activity-return"
  | "activity-long-work"
  | "time"
  | "idle"
  | "jane-meeting"
  | "rare";

export interface DialogueCandidate {
  key: string;
  priority: number;
  reason: ProactiveReason;
}

export interface ProactiveInput {
  hour: number;
  timeOfDay: TimeOfDay;
  /**
   * Away duration of a just-consumed away→active transition, in ms.
   * null = this cycle was not triggered by a return.
   */
  returnAwayMs: number | null;
  /** Continuous active-work duration so far (see ContinuousActiveTracker). */
  continuousActiveMs: number;
  /** The long-work nudge already fired in this work session. */
  longWorkNudged: boolean;
  /** A future (or today) "next Jane" date exists. */
  hasFutureMeeting: boolean;
}

/**
 * Which time pool belongs to the current moment. morning / afternoon /
 * evening come straight from TimeContext (5–12 / 12–18 / 18–23); the
 * TimeContext "night" band refines into two pools by hour:
 *   23:00–01:59 → time.lateNight      02:00–04:59 → time.deepNight.rare
 */
export function timeDialogueKey(
  hour: number,
  timeOfDay: TimeOfDay,
): string | null {
  if (timeOfDay === "morning") return "time.morning";
  if (timeOfDay === "afternoon") return "time.afternoon";
  if (timeOfDay === "evening") return "time.evening";
  const nightHours = PROACTIVE_CONFIG.lateNightHours as readonly number[];
  const deepNightHours = PROACTIVE_CONFIG.deepNightHours as readonly number[];
  if (nightHours.includes(hour)) return "time.lateNight";
  if (deepNightHours.includes(hour)) {
    return "time.deepNight.rare";
  }
  return null;
}

/** short / long return pool by away duration; null when the stay was too brief. */
export function returnKeyFor(awayMs: number): string | null {
  if (awayMs >= PROACTIVE_CONFIG.returnLongAfterMs) return "activity.return.long";
  if (awayMs >= PROACTIVE_CONFIG.returnShortAfterMs) {
    return "activity.return.short";
  }
  return null;
}

/**
 * Ordered candidates for one proactive cycle. The caller requests them in
 * order through DialogueEngine and stops at the first non-null line — the
 * engine's cooldowns may strike out a high-priority candidate, in which case
 * the next tier gets its chance (still max ONE line per cycle).
 */
export function collectProactiveDialogueCandidates(
  input: ProactiveInput,
): DialogueCandidate[] {
  const out: DialogueCandidate[] = [];

  if (input.returnAwayMs !== null) {
    const key = returnKeyFor(input.returnAwayMs);
    if (key) out.push({ key, priority: 90, reason: "activity-return" });
  }

  if (
    !input.longWorkNudged &&
    input.continuousActiveMs >= PROACTIVE_CONFIG.longWorkAfterMs
  ) {
    out.push({
      key: "activity.longWork",
      priority: 70,
      reason: "activity-long-work",
    });
  }

  const timeKey = timeDialogueKey(input.hour, input.timeOfDay);
  if (timeKey) out.push({ key: timeKey, priority: 60, reason: "time" });

  out.push({ key: "idle.general", priority: 40, reason: "idle" });

  if (input.hasFutureMeeting) {
    out.push({ key: "jane.meeting", priority: 20, reason: "jane-meeting" });
  }
  out.push({ key: "rare.general", priority: 10, reason: "rare" });

  return out.sort((a, b) => b.priority - a.priority);
}

/**
 * Continuous-active-work accumulator for the long-work nudge. Fed by the
 * activity poll: samples below the break threshold count towards the work
 * session; a sample at/above it ends the session (real break → reset, so
 * work time never accumulates across a genuine pause).
 */
export class ContinuousActiveTracker {
  private continuousMs = 0;
  private lastPresentAt: number | null = null;

  push(now: number, idleMs: number, breakResetAfterMs: number): void {
    if (idleMs >= breakResetAfterMs) {
      this.continuousMs = 0;
      this.lastPresentAt = null;
      return;
    }
    if (this.lastPresentAt !== null) {
      // Clamp the delta so a suspended tab or clock jump can't dump hours in.
      const delta = Math.min(
        Math.max(0, now - this.lastPresentAt),
        PROACTIVE_CONFIG.maxSampleDeltaMs,
      );
      this.continuousMs += delta;
    }
    this.lastPresentAt = now;
  }

  getContinuousMs(): number {
    return this.continuousMs;
  }
}
