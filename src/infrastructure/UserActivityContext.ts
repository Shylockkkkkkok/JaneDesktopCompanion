import type { UserActivityState } from "../types/behavior";
import { ACTIVITY_CONFIG } from "../config/behavior";
import { PROACTIVE_CONFIG } from "../config/dialogue";
import { ContinuousActiveTracker } from "./ProactiveDialogueResolver";
import { getSystemIdleTime } from "../services/system";

type Listener = () => void;

/**
 * Coarse user-presence tracker. Polls the system idle time and maps it to
 * active / temporarilyAway / longAway. It never reads which app or content the
 * user is using — only "how long since the last input".
 *
 * Also owns two proactive-dialogue signals:
 *  - a ONE-SHOT away→active return transition (with the away duration), and
 *  - the continuous-active-work accumulator for the long-work nudge
 *    (a real break — idle ≥ longWorkBreakResetMs — resets the session).
 */
class UserActivityContext {
  private state: UserActivityState = "active";
  private override: UserActivityState | null = null;
  private listeners = new Set<Listener>();
  private pollTimer: number | null = null;
  private lastIdleSec: number | null = null;
  private pendingReturn: { awayMs: number } | null = null;
  private tracker = new ContinuousActiveTracker();
  private longWorkNudged = false;

  getState(): UserActivityState {
    return this.override ?? this.state;
  }

  /** Debug/testing: force a state; null clears the override. */
  setOverride(state: UserActivityState | null): void {
    this.override = state;
    this.notify();
  }

  subscribe(fn: Listener): () => void {
    this.listeners.add(fn);
    this.ensurePolling();
    return () => {
      this.listeners.delete(fn);
      this.stopPollingIfUnused();
    };
  }

  /**
   * The pending away→active transition, or null. Consumed on read — the
   * return dialogue must fire at most once per real transition.
   */
  consumeReturn(): { awayMs: number } | null {
    const pending = this.pendingReturn;
    this.pendingReturn = null;
    return pending;
  }

  /** Continuous active-work duration of the current session (ms). */
  getContinuousActiveMs(): number {
    return this.tracker.getContinuousMs();
  }

  /** The long-work nudge already fired during this work session. */
  isLongWorkNudged(): boolean {
    return this.longWorkNudged;
  }

  markLongWorkNudged(): void {
    this.longWorkNudged = true;
  }

  private ensurePolling(): void {
    if (this.pollTimer !== null) return;
    this.pollTimer = window.setInterval(() => {
      void this.poll();
    }, ACTIVITY_CONFIG.pollIntervalMs);
  }

  private stopPollingIfUnused(): void {
    if (this.listeners.size === 0 && this.pollTimer !== null) {
      window.clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
  }

  private async poll(): Promise<void> {
    if (this.override !== null) return;
    let idleSec: number;
    try {
      idleSec = await getSystemIdleTime();
    } catch {
      return; // keep the current state on failure
    }

    const prevIdleSec = this.lastIdleSec;
    this.lastIdleSec = idleSec;

    // Long-work tracking: a sample at/above the break threshold ends the
    // session; anything below counts towards it.
    this.tracker.push(
      Date.now(),
      idleSec * 1000,
      PROACTIVE_CONFIG.longWorkBreakResetMs,
    );
    if (this.tracker.getContinuousMs() === 0) this.longWorkNudged = false;

    const next = this.mapIdleToState(idleSec);
    if (next !== this.state) {
      const prev = this.state;
      this.state = next;
      if (prev !== "active" && next === "active") {
        // One-shot return transition. awayMs = the idle seconds observed at
        // the LAST away poll — within one poll interval of the real absence.
        this.pendingReturn = { awayMs: Math.round((prevIdleSec ?? 0) * 1000) };
      }
      this.notify();
    }
  }

  private mapIdleToState(idleSec: number): UserActivityState {
    if (idleSec >= ACTIVITY_CONFIG.longAwayAfterSec) return "longAway";
    if (idleSec >= ACTIVITY_CONFIG.temporarilyAwayAfterSec) return "temporarilyAway";
    return "active";
  }

  private notify(): void {
    for (const fn of this.listeners) fn();
  }
}

export const userActivity = new UserActivityContext();
