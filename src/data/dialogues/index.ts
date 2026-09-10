import type { DialogueEntry } from "../../types/dialogue";
import { idleGeneral } from "./idle";
import {
  interactionClick,
  interactionHover,
  interactionRapidHigh,
  interactionRapidMedium,
  interactionRapidRare,
} from "./interaction";
import {
  timeAfternoon,
  timeDeepNightRare,
  timeEvening,
  timeLateNight,
  timeMorning,
} from "./time";
import {
  activityLongWork,
  activityReturnLong,
  activityReturnShort,
} from "./activity";
import { rareGeneral } from "./rare";
import { janeMeeting } from "./jane";
import { focusActiveClick, focusComplete, focusStart } from "./focus";
import { goalsCompleteAll, goalsCompleteOne } from "./goals";
import {
  concertCountdown3,
  concertCountdown7,
  concertCountdown30,
  concertToday,
  concertTomorrow,
} from "./concert";
import { timelineRecordAdded } from "./timeline";

/**
 * Central registry: a stable semantic key → dialogue entries. Business code
 * calls `dialogueEngine.request(key)` and never imports these arrays directly.
 */
export const DIALOGUE_REGISTRY: Record<string, DialogueEntry[]> = {
  "idle.general": idleGeneral,

  "interaction.hover": interactionHover,
  "interaction.click": interactionClick,
  "interaction.rapidClick.medium": interactionRapidMedium,
  "interaction.rapidClick.high": interactionRapidHigh,
  "interaction.rapidClick.rare": interactionRapidRare,

  "time.morning": timeMorning,
  "time.afternoon": timeAfternoon,
  "time.evening": timeEvening,
  "time.lateNight": timeLateNight,
  "time.deepNight.rare": timeDeepNightRare,

  "activity.return.short": activityReturnShort,
  "activity.return.long": activityReturnLong,
  "activity.longWork": activityLongWork,

  "focus.start": focusStart,
  "focus.activeClick": focusActiveClick,
  "focus.complete": focusComplete,

  "goals.completeOne": goalsCompleteOne,
  "goals.completeAll": goalsCompleteAll,

  "concert.countdown30": concertCountdown30,
  "concert.countdown7": concertCountdown7,
  "concert.countdown3": concertCountdown3,
  "concert.tomorrow": concertTomorrow,
  "concert.today": concertToday,

  "timeline.recordAdded": timelineRecordAdded,

  "rare.general": rareGeneral,
  "jane.meeting": janeMeeting,
};

export function getDialogueEntries(key: string): DialogueEntry[] | undefined {
  return DIALOGUE_REGISTRY[key];
}
