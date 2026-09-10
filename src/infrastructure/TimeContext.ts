import type { TimeContext, TimeOfDay } from "../types/behavior";
import { TIME_CONFIG } from "../config/behavior";

type Listener = () => void;

function timeOfDayForHour(hour: number): TimeOfDay {
  if (hour >= TIME_CONFIG.morningStart && hour < TIME_CONFIG.afternoonStart) {
    return "morning";
  }
  if (hour >= TIME_CONFIG.afternoonStart && hour < TIME_CONFIG.eveningStart) {
    return "afternoon";
  }
  if (hour >= TIME_CONFIG.eveningStart && hour < TIME_CONFIG.nightStart) {
    return "evening";
  }
  return "night";
}

function buildContext(date: Date): TimeContext {
  const hour = date.getHours();
  return { now: date, hour, timeOfDay: timeOfDayForHour(hour) };
}

/**
 * Independent time service. `get()` returns the live time context; the debug
 * panel can `setOverride` to simulate a different time of day. Subscribers are
 * notified on override changes and on a periodic refresh (so time-of-day rolls
 * over without the caller doing anything).
 */
class TimeContextService {
  private override: TimeContext | null = null;
  private listeners = new Set<Listener>();
  private refreshTimer: number | null = null;

  get(): TimeContext {
    return this.override ?? buildContext(new Date());
  }

  setOverride(ctx: TimeContext | null): void {
    this.override = ctx;
    this.notify();
  }

  /** Convenience for the debug panel: override by hour (time-of-day). */
  setOverrideHour(hour: number): void {
    const d = new Date();
    d.setHours(hour, 0, 0, 0);
    this.override = { now: d, hour, timeOfDay: timeOfDayForHour(hour) };
    this.notify();
  }

  subscribe(fn: Listener): () => void {
    this.listeners.add(fn);
    this.ensureRefresh();
    return () => {
      this.listeners.delete(fn);
      this.stopRefreshIfUnused();
    };
  }

  private notify(): void {
    for (const fn of this.listeners) fn();
  }

  private ensureRefresh(): void {
    if (this.refreshTimer !== null) return;
    // Re-notify periodically so the displayed time-of-day stays current.
    this.refreshTimer = window.setInterval(() => this.notify(), 60_000);
  }

  private stopRefreshIfUnused(): void {
    if (this.listeners.size === 0 && this.refreshTimer !== null) {
      window.clearInterval(this.refreshTimer);
      this.refreshTimer = null;
    }
  }
}

export const timeContext = new TimeContextService();
