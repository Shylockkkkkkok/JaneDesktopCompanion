export type FocusStatus = "idle" | "running" | "paused";

/** Result of a focus session ending (finish vs cancel). */
export interface FocusSessionEnd {
  completed: boolean;
  startTime: number;
  plannedDurationMs: number;
  actualDurationMs: number;
}

/** A persisted focus-history record. */
export interface FocusRecord {
  startTime: number;
  endTime: number;
  plannedDurationMs: number;
  actualDurationMs: number;
  completed: boolean;
}
