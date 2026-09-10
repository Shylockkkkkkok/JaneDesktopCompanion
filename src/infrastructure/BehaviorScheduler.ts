import type { BehaviorEvent, BehaviorKind } from "../types/behavior";
import {
  BEHAVIORS,
  IDLE_MOTION_DURATION,
  IDLE_MOTIONS,
  SCHEDULER_CONFIG,
} from "../config/behavior";
import { timeContext } from "./TimeContext";
import { userActivity } from "./UserActivityContext";
import { focusSession } from "./FocusSession";
import { concertStore } from "./ConcertStore";
import { randomBetween, randomItem } from "../utils/random";

type Listener = (event: BehaviorEvent) => void;

/**
 * Low-disturbance behavior scheduler. On a randomised cadence it picks a
 * behaviour (weighted random, subject to per-behaviour cooldown + conditions)
 * and emits a {@link BehaviorEvent}. Consumers react to the event; the
 * scheduler itself knows nothing about the character controller.
 *
 * `priority` on each behaviour is declared for future preemption; selection
 * currently uses `weight`.
 */
class BehaviorScheduler {
  private listeners = new Set<Listener>();
  private lastRunAt = new Map<BehaviorKind, number>();
  private timer: number | null = null;
  private running = false;

  start(): void {
    if (this.running) return;
    this.running = true;
    this.scheduleTick();
  }

  stop(): void {
    this.running = false;
    if (this.timer !== null) window.clearTimeout(this.timer);
    this.timer = null;
  }

  /** Interrupt/cancel any pending tick (e.g. on user interaction) and re-arm. */
  interrupt(): void {
    if (this.timer !== null) window.clearTimeout(this.timer);
    this.timer = null;
    if (this.running) this.scheduleTick();
  }

  /** Manually fire a behavior (used by the debug panel). */
  trigger(kind: BehaviorKind): void {
    const event = this.buildEvent(kind);
    if (!event) return;
    this.lastRunAt.set(kind, Date.now());
    for (const fn of this.listeners) fn(event);
  }

  /** Remaining cooldown (ms) for a behavior kind — for the debug panel. */
  getCooldownRemaining(kind: BehaviorKind): number {
    const last = this.lastRunAt.get(kind) ?? 0;
    const def = BEHAVIORS.find((b) => b.kind === kind);
    return Math.max(0, (def?.cooldownMs ?? 0) - (Date.now() - last));
  }

  subscribe(fn: Listener): () => void {
    this.listeners.add(fn);
    return () => {
      this.listeners.delete(fn);
    };
  }

  private scheduleTick(): void {
    const delay = randomBetween(
      SCHEDULER_CONFIG.tickIntervalMinMs,
      SCHEDULER_CONFIG.tickIntervalMaxMs,
    );
    this.timer = window.setTimeout(() => {
      if (!this.running) return;
      this.tick();
      this.scheduleTick();
    }, delay);
  }

  private tick(): void {
    // During a focus session, never fire ordinary auto behaviors
    // (idle motion, idle speech, …).
    if (focusSession.isActive()) return;
    if (Math.random() < SCHEDULER_CONFIG.skipChance) return;
    const kind = this.pickKind();
    if (!kind) return;
    const event = this.buildEvent(kind);
    if (!event) return;

    this.lastRunAt.set(kind, Date.now());
    for (const fn of this.listeners) fn(event);
  }

  private pickKind(): BehaviorKind | null {
    const now = Date.now();
    const condition = {
      time: timeContext.get(),
      activity: userActivity.getState(),
      concert: concertStore.getContext(),
    };

    const eligible = BEHAVIORS.filter((b) => {
      const last = this.lastRunAt.get(b.kind) ?? 0;
      if (now - last < b.cooldownMs) return false;
      return b.canRun(condition);
    });
    if (eligible.length === 0) return null;

    const totalWeight = eligible.reduce((sum, b) => sum + b.weight, 0);
    let r = Math.random() * totalWeight;
    for (const b of eligible) {
      r -= b.weight;
      if (r <= 0) return b.kind;
    }
    return eligible[0].kind;
  }

  private buildEvent(kind: BehaviorKind): BehaviorEvent | null {
    if (kind === "idleMotion") {
      return {
        kind: "idleMotion",
        motion: randomItem(IDLE_MOTIONS),
        durationMs: Math.round(
          randomBetween(IDLE_MOTION_DURATION.minMs, IDLE_MOTION_DURATION.maxMs),
        ),
      };
    }
    if (kind === "idleSpeak") {
      return { kind: "idleSpeak" };
    }
    if (kind === "concert") {
      return { kind: "concert" };
    }
    return null;
  }
}

export const behaviorScheduler = new BehaviorScheduler();
