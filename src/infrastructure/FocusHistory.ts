import type { FocusRecord } from "../types/focus";

const STORAGE_KEY = "jane.focus-history.v1";
const MAX_RECORDS = 100;

/**
 * Local-only focus history. Records just the essentials; never leaves the
 * machine. Completed vs cancelled is kept distinct so a cancelled session is
 * not counted as a completion.
 */
class FocusHistory {
  private records: FocusRecord[];

  constructor() {
    this.records = this.load();
  }

  add(record: FocusRecord): void {
    this.records.push(record);
    if (this.records.length > MAX_RECORDS) {
      this.records = this.records.slice(-MAX_RECORDS);
    }
    this.save();
  }

  getAll(): FocusRecord[] {
    return this.records;
  }

  private load(): FocusRecord[] {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]");
    } catch {
      return [];
    }
  }

  private save(): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.records));
    } catch {
      /* non-fatal */
    }
  }
}

export const focusHistory = new FocusHistory();
