import type { TimelineRecord, TimelineEventType } from "../types/timeline";

const STORAGE_KEY = "jane.timeline.v1";
/** Remembers which past Next Jane dates the user chose to ignore. */
const DISMISS_KEY = "jane.timeline.suggest.v1";

function genId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Local-only "I saw Jane" timeline. Records are always kept sorted by date
 * (newest first). Duplication is allowed deliberately: one date can host
 * several occasions. A small dismiss state prevents the past-concert
 * suggestion from nagging repeatedly.
 */
class TimelineStore {
  private records: TimelineRecord[];
  private dismissedDates: string[];
  private listeners = new Set<() => void>();

  constructor() {
    this.records = this.loadRecords();
    this.dismissedDates = this.loadDismissed();
    // The timeline window and the character window are separate webviews;
    // localStorage `storage` events keep their in-memory state in sync.
    if (typeof window !== "undefined") {
      window.addEventListener("storage", (e) => {
        if (e.key !== STORAGE_KEY && e.key !== DISMISS_KEY) return;
        this.records = this.loadRecords();
        this.dismissedDates = this.loadDismissed();
        this.notify();
      });
    }
  }

  /** All records, newest first. */
  getAll(): TimelineRecord[] {
    return [...this.records];
  }

  getCount(): number {
    return this.records.length;
  }

  hasDate(date: string): boolean {
    return this.records.some((r) => r.date === date);
  }

  /** Add a record. Returns the created entry. */
  add(
    date: string,
    city: string,
    eventType: TimelineEventType,
    note: string,
  ): TimelineRecord {
    const now = Date.now();
    const record: TimelineRecord = {
      id: genId(),
      date,
      city,
      eventType,
      note,
      createdAt: now,
      updatedAt: now,
    };
    this.records.push(record);
    this.sort();
    this.saveRecords();
    this.notify();
    return record;
  }

  update(
    id: string,
    fields: Partial<
      Pick<TimelineRecord, "date" | "city" | "eventType" | "note" | "coverImage">
    >,
  ): void {
    const record = this.records.find((r) => r.id === id);
    if (!record) return;
    Object.assign(record, fields);
    record.updatedAt = Date.now();
    this.sort();
    this.saveRecords();
    this.notify();
  }

  /** Set or clear (null) the cover image ref. File management lives in services. */
  setCover(id: string, ref: string | null): void {
    const record = this.records.find((r) => r.id === id);
    if (!record) return;
    if (ref === null) {
      delete record.coverImage;
    } else {
      record.coverImage = ref;
    }
    record.updatedAt = Date.now();
    this.saveRecords();
    this.notify();
  }

  remove(id: string): void {
    this.records = this.records.filter((r) => r.id !== id);
    this.saveRecords();
    this.notify();
  }

  // ── suggestion dismissal ("don't ask again for this event") ──

  isDismissed(date: string): boolean {
    return this.dismissedDates.includes(date);
  }

  dismissDate(date: string): void {
    if (this.isDismissed(date)) return;
    this.dismissedDates.push(date);
    this.saveDismissed();
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

  /** Newest first; stable for same-day entries by createdAt descending. */
  private sort(): void {
    this.records.sort((a, b) =>
      a.date === b.date ? b.createdAt - a.createdAt : b.date.localeCompare(a.date),
    );
  }

  private loadRecords(): TimelineRecord[] {
    try {
      const parsed: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]");
      return Array.isArray(parsed) ? (parsed as TimelineRecord[]) : [];
    } catch {
      return [];
    }
  }

  private saveRecords(): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.records));
    } catch {
      /* non-fatal */
    }
  }

  private loadDismissed(): string[] {
    try {
      const parsed: unknown = JSON.parse(localStorage.getItem(DISMISS_KEY) ?? "[]");
      return Array.isArray(parsed) ? (parsed as string[]) : [];
    } catch {
      return [];
    }
  }

  private saveDismissed(): void {
    try {
      localStorage.setItem(DISMISS_KEY, JSON.stringify(this.dismissedDates));
    } catch {
      /* non-fatal */
    }
  }
}

export const timelineStore = new TimelineStore();
