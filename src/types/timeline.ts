/** One past "I saw Jane" occasion (concert / festival / event / other). */
export type TimelineEventType = "concert" | "festival" | "event" | "other";

/** Chinese labels for the timeline event types (UI only, never persisted). */
export const TIMELINE_EVENT_TYPE_LABELS: Record<TimelineEventType, string> = {
  concert: "演唱会",
  festival: "音乐节",
  event: "活动",
  other: "其他",
};

export interface TimelineRecord {
  id: string;
  /** Local date "YYYY-MM-DD" of the occasion. */
  date: string;
  city: string;
  eventType: TimelineEventType;
  note: string;
  createdAt: number;
  updatedAt: number;
  /**
   * Optional cover image (max 1 per record): an app-managed relative ref
   * like "<recordId>/cover.png" under the app data timeline-assets dir.
   * Old records created before this field existed simply omit it.
   */
  coverImage?: string;
}
