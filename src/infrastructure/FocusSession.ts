import type { FocusSessionEnd, FocusStatus } from "../types/focus";
import { FOCUS_CONFIG } from "../config/focus";

type Listener = () => void;
type EndListener = (result: FocusSessionEnd) => void;

/**
 * Focus-session state machine: idle → running ⇄ paused → idle.
 * `finish()` (or the timer reaching zero) → completed; `cancel()` → cancelled.
 * Both emit a {@link FocusSessionEnd} with the actual (pause-excluded) duration.
 */
class FocusSession {
  private status: FocusStatus = "idle";
  private plannedDurationMs = 0;
  private remainingMs = 0;
  private startedAt = 0;
  private endAt = 0;
  private pausedAt = 0;
  private pausedAccumMs = 0;
  private timer: number | null = null;
  private listeners = new Set<Listener>();
  private endListeners = new Set<EndListener>();

  getStatus(): FocusStatus {
    return this.status;
  }

  getRemainingMs(): number {
    return this.remainingMs;
  }

  getPlannedDurationMs(): number {
    return this.plannedDurationMs;
  }

  /** True while a session is running or paused. */
  isActive(): boolean {
    return this.status === "running" || this.status === "paused";
  }

  start(durationMs: number): void {
    if (this.isActive()) return;
    this.status = "running";
    this.plannedDurationMs = durationMs;
    this.remainingMs = durationMs;
    this.startedAt = Date.now();
    this.endAt = this.startedAt + durationMs;
    this.pausedAccumMs = 0;
    this.ensureTimer();
    this.notify();
  }

  pause(): void {
    if (this.status !== "running") return;
    this.status = "paused";
    this.remainingMs = Math.max(0, this.endAt - Date.now());
    this.pausedAt = Date.now();
    this.stopTimer();
    this.notify();
  }

  resume(): void {
    if (this.status !== "paused") return;
    this.status = "running";
    this.pausedAccumMs += Date.now() - this.pausedAt;
    this.endAt = Date.now() + this.remainingMs;
    this.ensureTimer();
    this.notify();
  }

  finish(): void {
    if (!this.isActive()) return;
    this.stopTimer();
    const result = this.buildEnd(true);
    this.reset();
    this.emitEnd(result);
    this.notify();
  }

  cancel(): void {
    if (!this.isActive()) return;
    this.stopTimer();
    const result = this.buildEnd(false);
    this.reset();
    this.emitEnd(result);
    this.notify();
  }

  /** Debug helper: shrink the remaining time to a few seconds. */
  setRemaining(ms: number): void {
    if (this.status === "running") {
      this.remainingMs = Math.max(0, ms);
      this.endAt = Date.now() + this.remainingMs;
    } else if (this.status === "paused") {
      this.remainingMs = Math.max(0, ms);
    }
    this.notify();
  }

  subscribe(fn: Listener): () => void {
    this.listeners.add(fn);
    return () => {
      this.listeners.delete(fn);
    };
  }

  onSessionEnd(fn: EndListener): () => void {
    this.endListeners.add(fn);
    return () => {
      this.endListeners.delete(fn);
    };
  }

  private ensureTimer(): void {
    if (this.timer !== null) return;
    this.timer = window.setInterval(() => this.tick(), FOCUS_CONFIG.tickIntervalMs);
  }

  private stopTimer(): void {
    if (this.timer !== null) {
      window.clearInterval(this.timer);
      this.timer = null;
    }
  }

  private tick(): void {
    if (this.status !== "running") return;
    this.remainingMs = Math.max(0, this.endAt - Date.now());
    this.notify();
    if (this.remainingMs <= 0) {
      this.finish();
    }
  }

  private buildEnd(completed: boolean): FocusSessionEnd {
    const endTime = Date.now();
    return {
      completed,
      startTime: this.startedAt,
      plannedDurationMs: this.plannedDurationMs,
      actualDurationMs: endTime - this.startedAt - this.pausedAccumMs,
    };
  }

  private reset(): void {
    this.status = "idle";
    this.remainingMs = 0;
    this.plannedDurationMs = 0;
    this.pausedAccumMs = 0;
  }

  private notify(): void {
    for (const fn of this.listeners) fn();
  }

  private emitEnd(result: FocusSessionEnd): void {
    for (const fn of this.endListeners) fn(result);
  }
}

export const focusSession = new FocusSession();
