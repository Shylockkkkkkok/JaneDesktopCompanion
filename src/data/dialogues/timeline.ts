import { dlg } from "../../types/dialogue";

/**
 * Shown once (light reaction) after the user saves a new timeline record.
 * The third line is intentionally low-weight and only eligible when at least
 * 3 records exist — see `DialogueContext.timelineCount`.
 */
export const timelineRecordAdded = [
  dlg("timeline.recordAdded.1", "还是会说你说过的话~", 10, "gentle"),
  dlg("timeline.recordAdded.2", "你怦然涌现，我蓦然回首", 10, "gentle"),
  dlg(
    "timeline.recordAdded.3",
    "原来已经见过这么多次了！",
    1,
    "rare",
    { when: (ctx) => (ctx.timelineCount ?? 0) >= 3 },
  ),
];
