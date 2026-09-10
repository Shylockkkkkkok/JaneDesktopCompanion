// Standalone test for the CharacterAction system (config + ActionPlayer),
// covering both the PNG-sequence pipeline and the video pipeline.
import assert from "node:assert";

const backing = new Map();
globalThis.window = { addEventListener: () => {}, removeEventListener: () => {} };
globalThis.localStorage = {
  getItem: (k) => (backing.has(k) ? backing.get(k) : null),
  setItem: (k, v) => backing.set(k, String(v)),
  removeItem: (k) => backing.delete(k),
};

const {
  CHARACTER_ACTIONS,
  ACTION_SEQUENCES,
  ACTION_VIDEOS,
  registerActionVideoUrl,
  resolveAction,
  isActionAllowed,
  actionMenuItems,
  getActionDef,
  getActionVideoSpec,
} = await import("../src/config/characterActions.ts");
const { actionPlayer } = await import("../src/infrastructure/ActionPlayer.ts");
const { actionVideoCalibration } = await import(
  "../src/infrastructure/ActionVideoCalibration.ts"
);

// ── 1. Manifest: six video actions + the first real webm (小猫疑惑) ──
assert.deepEqual(
  CHARACTER_ACTIONS.map((a) => a.id),
  ["heart", "adjustGlasses", "catAngry", "catPeek", "smile", "trexCute", "catConfused"],
);
assert.equal(getActionDef("heart").label, "比个心");
assert.equal(getActionDef("adjustGlasses").label, "扶眼镜");
assert.ok(ACTION_VIDEOS["vid.heart"], "heart has a video spec");
assert.equal(ACTION_VIDEOS["vid.heart"].muted, true);
assert.equal(getActionVideoSpec("catConfused").file, "小猫疑惑");

// Outside Vite no files are scanned — video actions are unavailable, never errors.
for (const def of CHARACTER_ACTIONS) {
  assert.equal(resolveAction(def), null, `${def.id} unavailable without files`);
}

// ── 2. Register a URL (simulates the Vite glob result) → video resolves ──
registerActionVideoUrl("小猫疑惑", "/assets/catConfused.webm");
const catConfused = resolveAction(getActionDef("catConfused"));
assert.ok(catConfused);
assert.equal(catConfused.kind, "video");
assert.equal(catConfused.asset.type, "video");
assert.equal(catConfused.asset.src, "/assets/catConfused.webm");
assert.equal(catConfused.asset.loop, false);
assert.equal(catConfused.asset.muted, true);
assert.equal(catConfused.asset.playbackRate, undefined);

// webm beats mp4 for the same basename
registerActionVideoUrl("比心", "/assets/heart.mp4");
registerActionVideoUrl("比心", "/assets/heart.webm");
assert.equal(resolveAction(getActionDef("heart")).asset.src, "/assets/heart.webm");

// ── 3. Menu: hasAsset only where a URL is registered; generated from manifest ──
const menu = actionMenuItems({ focus: false, concert: false });
assert.equal(menu.length, CHARACTER_ACTIONS.length);
assert.deepEqual(
  menu.filter((m) => m.available).map((m) => m.def.id),
  ["heart", "catConfused"],
);
assert.ok(menu.every((m) => m.def.label.length > 0));

// ── 4. 门控：focus 全禁；concert 无 stage 动作 → 全禁 ──
for (const def of CHARACTER_ACTIONS) {
  assert.equal(isActionAllowed(def, { focus: true, concert: false }), false);
  assert.equal(isActionAllowed(def, { focus: false, concert: true }), false);
}
assert.equal(isActionAllowed(getActionDef("heart"), { focus: false, concert: false }), true);

// ── 5. Video playback flow: play → progress → ended → onComplete ──
let completed = 0;
actionPlayer.onComplete(() => {
  completed += 1;
});
assert.equal(actionPlayer.play("catConfused"), "started");
let st = actionPlayer.getState();
assert.equal(st.kind, "video");
assert.equal(st.actionId, "catConfused");
assert.equal(st.src, "/assets/catConfused.webm");
assert.equal(st.paused, false);
assert.equal(st.nonce, 1);
actionPlayer.reportVideoProgress(0.4, 1.0, false);
st = actionPlayer.getState();
assert.equal(st.currentTime, 0.4);
assert.equal(st.duration, 1.0);
actionPlayer.pauseVideo();
assert.equal(actionPlayer.getState().paused, true);
actionPlayer.resumeVideo();
assert.equal(actionPlayer.getState().paused, false);
actionPlayer.videoEnded();
assert.equal(actionPlayer.getState(), null, "video ended clears the action");
assert.equal(completed, 1, "onComplete fired once");

// ── 6. Interrupt: playing video replaced by another (interruptible) ──
registerActionVideoUrl("笑一下", "/assets/smile.webm");
assert.equal(actionPlayer.play("catConfused"), "started");
assert.equal(actionPlayer.play("smile"), "started");
assert.equal(actionPlayer.isPlaying("smile"), true);
assert.equal(actionPlayer.isPlaying("catConfused"), false);
assert.equal(actionPlayer.getState().src, "/assets/smile.webm");
assert.equal(completed, 1, "replacement does not complete the old action");

// ── 7. Toggle-off: clicking the playing action stops it ──
assert.equal(actionPlayer.play("smile"), "stopped");
assert.equal(actionPlayer.getState(), null);
assert.equal(completed, 2);

// ── 8. Restart bumps the nonce (video remounts) ──
assert.equal(actionPlayer.play("smile"), "started");
const nonceBefore = actionPlayer.getVideoNonce();
actionPlayer.restart();
assert.ok(actionPlayer.getVideoNonce() > nonceBefore);
assert.equal(actionPlayer.getState().actionId, "smile");
assert.equal(completed, 2, "restart does not complete");

// ── 9. stop(force) cleanup (drag / focus / exit path) ──
actionPlayer.stop(true);
assert.equal(actionPlayer.getState(), null);
assert.equal(completed, 3);

// ── 10. Sequence pipeline still works (regression, via a test action) ──
CHARACTER_ACTIONS.push({
  id: "seqTest",
  label: "测试序列",
  assetId: "seq.test",
  loop: false,
  interruptible: true,
  enabled: true,
});
ACTION_SEQUENCES["seq.test"] = { type: "sequence", frames: ["f0", "f1", "f2"], fps: 12 };
assert.equal(actionPlayer.play("seqTest"), "started");
st = actionPlayer.getState();
assert.equal(st.kind, "sequence");
assert.equal(st.totalFrames, 3);
assert.equal(st.fps, 12);
for (let i = 0; i < 2; i++) actionPlayer.handleTick();
assert.equal(actionPlayer.getState().frame, 2);
actionPlayer.handleTick(); // non-loop → completes
assert.equal(actionPlayer.getState(), null);
assert.equal(completed, 4);

// ── 11. Unavailable actions ──
assert.equal(actionPlayer.play("ghost"), "unavailable");
assert.equal(actionPlayer.play("catAngry"), "unavailable"); // no file registered

// ── 12. Calibration store: defaults → override → persist → reset ──
const defaults = { scale: 1, offsetX: 0, offsetY: 0 };
assert.deepEqual(actionVideoCalibration.get("catConfused", defaults), defaults);
actionVideoCalibration.set("catConfused", { scale: 1.25, offsetY: -12 });
assert.deepEqual(actionVideoCalibration.get("catConfused", defaults), {
  scale: 1.25,
  offsetX: 0,
  offsetY: -12,
});
assert.deepEqual(
  JSON.parse(backing.get("jane.action-video-cal.v1")).catConfused,
  { scale: 1.25, offsetY: -12 },
);
actionVideoCalibration.reset("catConfused");
assert.deepEqual(actionVideoCalibration.get("catConfused", defaults), defaults);

console.log("ALL CHARACTER ACTION TESTS PASSED");
