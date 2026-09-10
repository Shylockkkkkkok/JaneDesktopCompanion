import type { ConcertContext, ConcertEvent } from "../types/concert";

const STORAGE_KEY = "jane.concert.v1";

function todayStr(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Whole-day difference (event - today), using UTC to avoid DST drift. */
function daysUntil(dateStr: string): number {
  const [y, m, d] = todayStr().split("-").map(Number);
  const today = Date.UTC(y, m - 1, d);
  const [ty, tm, td] = dateStr.split("-").map(Number);
  const target = Date.UTC(ty, tm - 1, td);
  return Math.round((target - today) / 86_400_000);
}

function contextForDays(days: number): ConcertContext {
  if (days < 0) return "normal"; // past
  if (days === 0) return "today";
  if (days === 1) return "tomorrow";
  if (days <= 3) return "within3Days";
  if (days <= 7) return "within7Days";
  if (days <= 30) return "within30Days";
  return "normal";
}

/**
 * Local-only "next Jane" event store. Holds a single event; the context is
 * derived fresh on every read, so crossing midnight (or editing the date)
 * rolls over automatically. Past dates fall back to "normal".
 */
class ConcertStore {
  private event: ConcertEvent | null;
  private listeners = new Set<() => void>();

  constructor() {
    this.event = this.load();
  }

  getEvent(): ConcertEvent | null {
    return this.event;
  }

  getContext(): ConcertContext {
    if (!this.event) return "normal";
    return contextForDays(daysUntil(this.event.date));
  }

  /** Remaining whole days, or null when no event is set. */
  getDaysUntil(): number | null {
    if (!this.event) return null;
    return daysUntil(this.event.date);
  }

  isToday(): boolean {
    return this.getContext() === "today";
  }

  /**
   * A "next Jane" date exists and is not in the past — the gate for the
   * jane.meeting dialogue pool (never speak about a meeting that isn't
   * planned).
   */
  hasUpcomingMeeting(): boolean {
    const days = this.getDaysUntil();
    return days !== null && days >= 0;
  }

  /** The concert dialogue key for the current context, or null for "normal". */
  getDialogueKey(): string | null {
    switch (this.getContext()) {
      case "within30Days":
        return "concert.countdown30";
      case "within7Days":
        return "concert.countdown7";
      case "within3Days":
        return "concert.countdown3";
      case "tomorrow":
        return "concert.tomorrow";
      case "today":
        return "concert.today";
      default:
        return null;
    }
  }

  setEvent(event: Omit<ConcertEvent, "createdAt">): void {
    this.event = { ...event, createdAt: Date.now() };
    this.save();
    this.notify();
  }

  clearEvent(): void {
    this.event = null;
    this.save();
    this.notify();
  }

  subscribe(fn: () => void): () => void {
    this.listeners.add(fn);
    return () => {
      this.listeners.delete(fn);
    };
  }

  private notify(): void {
    for (const fn of this.listeners) fn();
  }

  private load(): ConcertEvent | null {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "null");
    } catch {
      return null;
    }
  }

  private save(): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.event));
    } catch {
      /* non-fatal */
    }
  }
}

export const concertStore = new ConcertStore();
