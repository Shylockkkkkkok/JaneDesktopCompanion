/** Proximity of the next "see Jane" concert, derived from the stored date. */
export type ConcertContext =
  | "normal"
  | "within30Days"
  | "within7Days"
  | "within3Days"
  | "tomorrow"
  | "today";

export interface ConcertEvent {
  /** Local date "YYYY-MM-DD" of the event. */
  date: string;
  city: string;
  note: string;
  createdAt: number;
}
