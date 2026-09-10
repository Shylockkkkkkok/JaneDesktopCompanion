import type { Goal } from "../types/goals";

const STORAGE_KEY = "jane.goals.v1";
const CELEBRATED_KEY = "jane.goals-celebrated.v1";

function todayStr(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function genId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Local-only today-goals store. Goals are kept flat with a `date`, so past
 * days remain as simple history (never deleted). "Today" is computed fresh on
 * every read, so crossing midnight rolls over automatically.
 */
class GoalsStore {
  private goals: Goal[];
  private listeners = new Set<() => void>();
  /** Date whose "all complete" was already celebrated (once per day). */
  private celebratedDate: string | null = null;

  constructor() {
    this.goals = this.load();
    this.celebratedDate = localStorage.getItem(CELEBRATED_KEY);
  }

  getToday(): string {
    return todayStr();
  }

  getTodayGoals(): Goal[] {
    const today = todayStr();
    return this.goals.filter((g) => g.date === today);
  }

  getAll(): Goal[] {
    return this.goals;
  }

  /** Add a goal for today. No quantity limit. */
  add(text: string): Goal {
    const today = todayStr();
    const goal: Goal = {
      id: genId(),
      text,
      completed: false,
      createdAt: Date.now(),
      completedAt: null,
      date: today,
    };
    this.goals.push(goal);
    this.save();
    this.notify();
    return goal;
  }

  updateText(id: string, text: string): void {
    const goal = this.goals.find((g) => g.id === id);
    if (!goal) return;
    goal.text = text;
    this.save();
    this.notify();
  }

  setCompleted(id: string, completed: boolean): void {
    const goal = this.goals.find((g) => g.id === id);
    if (!goal) return;
    goal.completed = completed;
    goal.completedAt = completed ? Date.now() : null;
    this.save();
    this.notify();
  }

  remove(id: string): void {
    this.goals = this.goals.filter((g) => g.id !== id);
    this.save();
    this.notify();
  }

  /** Remove every goal for today (used by the debug "Reset Today"). */
  removeToday(): void {
    const today = todayStr();
    this.goals = this.goals.filter((g) => g.date !== today);
    this.save();
    this.notify();
  }

  /**
   * True when every today-goal is complete AND today's "all complete"
   * celebration hasn't fired yet — the celebration fires once per day, so
   * re-completing after adding more goals falls back to the regular line.
   */
  shouldCelebrateAllComplete(): boolean {
    const today = todayStr();
    const goals = this.getTodayGoals();
    return (
      goals.length > 0 &&
      goals.every((g) => g.completed) &&
      this.celebratedDate !== today
    );
  }

  markAllCompleteCelebrated(): void {
    this.celebratedDate = todayStr();
    try {
      localStorage.setItem(CELEBRATED_KEY, this.celebratedDate);
    } catch {
      /* non-fatal */
    }
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

  private load(): Goal[] {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]");
    } catch {
      return [];
    }
  }

  private save(): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.goals));
    } catch {
      /* non-fatal */
    }
  }
}

export const goalsStore = new GoalsStore();
