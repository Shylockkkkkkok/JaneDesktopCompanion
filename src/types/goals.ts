/** A single today-goal. Belongs to one local calendar day (`date`). */
export interface Goal {
  id: string;
  text: string;
  completed: boolean;
  createdAt: number;
  completedAt: number | null;
  /** Local date "YYYY-MM-DD". */
  date: string;
}
