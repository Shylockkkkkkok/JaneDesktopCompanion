// Tests for the proactive dialogue wiring: resolver candidate collection,
// time-pool mapping, return thresholds, continuous-work tracking, engine
// focus suppression / cooldown fallbacks.
import assert from "node:assert";

const backing = new Map();
globalThis.window = {
  addEventListener: () => {},
  removeEventListener: () => {},
  setTimeout: () => 0,
  clearTimeout: () => {},
  setInterval: () => 0,
  clearInterval: () => {},
};
globalThis.localStorage = {
  getItem: (k) => (backing.has(k) ? backing.get(k) : null),
  setItem: (k, v) => backing.set(k, String(v)),
  removeItem: (k) => backing.delete(k),
};

const {
  timeDialogueKey,
  returnKeyFor,
  collectProactiveDialogueCandidates,
  ContinuousActiveTracker,
} = await import("../src/infrastructure/ProactiveDialogueResolver.ts");
const { dialogueEngine } = await import(
  "../src/infrastructure/DialogueEngine.ts"
);
const { focusSession } = await import("../src/infrastructure/FocusSession.ts");

// ── 1. Time → pool mapping (TimeContext bands + night refinement) ──
assert.equal(timeDialogueKey(8, "morning"), "time.morning");
assert.equal(timeDialogueKey(11, "morning"), "time.morning");
assert.equal(timeDialogueKey(12, "afternoon"), "time.afternoon");
assert.equal(timeDialogueKey(17, "afternoon"), "time.afternoon");
assert.equal(timeDialogueKey(18, "evening"), "time.evening");
assert.equal(timeDialogueKey(22, "evening"), "time.evening");
assert.equal(timeDialogueKey(23, "night"), "time.lateNight");
assert.equal(timeDialogueKey(0, "night"), "time.lateNight");
assert.equal(timeDialogueKey(1, "night"), "time.lateNight");
assert.equal(timeDialogueKey(2, "night"), "time.deepNight.rare");
assert.equal(timeDialogueKey(4, "night"), "time.deepNight.rare");

// ── 2. Return thresholds: <5min none, 5–30min short, ≥30min long ──
assert.equal(returnKeyFor(2 * 60_000), null);
assert.equal(returnKeyFor(5 * 60_000), "activity.return.short");
assert.equal(returnKeyFor(29 * 60_000), "activity.return.short");
assert.equal(returnKeyFor(30 * 60_000), "activity.return.long");
assert.equal(returnKeyFor(45 * 60_000), "activity.return.long");

// ── 3. Candidate collection: priority order ──
const c1 = collectProactiveDialogueCandidates({
  hour: 20, timeOfDay: "evening",
  returnAwayMs: 45 * 60_000,
  continuousActiveMs: 80 * 60_000, longWorkNudged: false,
  hasFutureMeeting: true,
});
assert.deepEqual(c1.map((c) => c.key), [
  "activity.return.long",
  "activity.longWork",
  "time.evening",
  "idle.general",
  "jane.meeting",
  "rare.general",
]);
assert.equal(c1[0].reason, "activity-return");

const c2 = collectProactiveDialogueCandidates({
  hour: 8, timeOfDay: "morning",
  returnAwayMs: null,
  continuousActiveMs: 80 * 60_000, longWorkNudged: false,
  hasFutureMeeting: false,
});
assert.deepEqual(c2.map((c) => c.key), [
  "activity.longWork",
  "time.morning",
  "idle.general",
  "rare.general",
]);

// nudged → no long-work candidate; no future meeting → no jane.meeting.
const c3 = collectProactiveDialogueCandidates({
  hour: 8, timeOfDay: "morning",
  returnAwayMs: null,
  continuousActiveMs: 99 * 60_000, longWorkNudged: true,
  hasFutureMeeting: false,
});
assert.equal(c3.some((c) => c.key === "activity.longWork"), false);
assert.equal(c3.some((c) => c.key === "jane.meeting"), false);

// ── 4. ContinuousActiveTracker: accumulate, break resets, clamped jumps ──
const t = new ContinuousActiveTracker();
t.push(0, 0, 5 * 60_000);
t.push(60_000, 0, 5 * 60_000);   // +60s
t.push(120_000, 30_000, 5 * 60_000); // short idle blip still counts
assert.equal(t.getContinuousMs(), 120_000);
t.push(150_000, 6 * 60_000, 5 * 60_000); // ≥5min idle → real break
assert.equal(t.getContinuousMs(), 0);
t.push(160_000, 0, 5 * 60_000);
t.push(600_000 + 160_000, 0, 5 * 60_000); // 10min gap (suspended tab) → clamped
assert.ok(t.getContinuousMs() <= 120_000 + 60_000, "suspension dump clamped");

// ── 5. Focus suppression really silences every proactive pool ──
dialogueEngine.resetCooldowns();
dialogueEngine.clearRecent();
focusSession.start(25 * 60_000);
assert.equal(focusSession.isActive(), true);
for (const key of [
  "time.morning", "time.afternoon", "time.evening", "time.lateNight",
  "time.deepNight.rare", "activity.return.short", "activity.return.long",
  "activity.longWork", "idle.general", "rare.general", "jane.meeting",
]) {
  assert.equal(dialogueEngine.request(key), null, `${key} suppressed in focus`);
}
focusSession.cancel();
assert.equal(focusSession.isActive(), false);

// ── 6. Engine cooldown: a pool fires once, then cools down ──
dialogueEngine.resetCooldowns();
dialogueEngine.clearRecent();
const first = dialogueEngine.request("time.evening", {
  timeOfDay: "evening", activity: "active", timelineCount: 0,
});
assert.ok(first && first.length > 0, "time.evening fires");
assert.equal(
  dialogueEngine.request("time.evening", {
    timeOfDay: "evening", activity: "active", timelineCount: 0,
  }),
  null,
  "second request inside cooldown is null",
);
// Recent-line dedup recorded the pick.
assert.ok(
  dialogueEngine.getRecentIds().some((id) => id.startsWith("time.evening.")),
  "recentDialogueIds records the pick",
);

// ── 7. One-line-per-cycle fallback: cooled pool → next tier ──
// Simulate the App loop: candidates in order, stop at the first success.
function runCycle(input) {
  for (const candidate of collectProactiveDialogueCandidates(input)) {
    const text = dialogueEngine.request(candidate.key, {
      timeOfDay: input.timeOfDay,
      activity: "active",
      timelineCount: 0,
    });
    if (text) return { key: candidate.key, text };
  }
  return null;
}
dialogueEngine.resetCooldowns();
dialogueEngine.clearRecent();
const cycle1 = runCycle({
  hour: 20, timeOfDay: "evening", returnAwayMs: null,
  continuousActiveMs: 0, longWorkNudged: true, hasFutureMeeting: true,
});
assert.equal(cycle1.key, "time.evening", "time wins over idle/rare");
const cycle2 = runCycle({
  hour: 20, timeOfDay: "evening", returnAwayMs: null,
  continuousActiveMs: 0, longWorkNudged: true, hasFutureMeeting: true,
});
assert.equal(cycle2.key, "idle.general", "cooled time falls through to idle");

console.log("ALL PROACTIVE DIALOGUE TESTS PASSED");
