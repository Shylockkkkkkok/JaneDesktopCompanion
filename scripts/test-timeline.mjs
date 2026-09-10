// Standalone data-layer test for TimelineStore (runs in Node with a localStorage shim).
import assert from "node:assert";

// localStorage shim (in-memory map acting as persistent storage)
const backing = new Map();
globalThis.window = {
  addEventListener: () => {},
  removeEventListener: () => {},
};
globalThis.localStorage = {
  getItem: (k) => (backing.has(k) ? backing.get(k) : null),
  setItem: (k, v) => backing.set(k, String(v)),
  removeItem: (k) => backing.delete(k),
};

// ── 0. 旧数据兼容：预置一条没有 coverImage 字段的历史记录 ──
backing.set(
  "jane.timeline.v1",
  JSON.stringify([
    {
      id: "legacy-001",
      date: "2024-01-01",
      city: "广州",
      eventType: "other",
      note: "没有封面图的旧记录",
      createdAt: 1704038400000,
      updatedAt: 1704038400000,
    },
  ]),
);

const { timelineStore } = await import("../src/infrastructure/TimelineStore.ts");

// 0a. 旧记录正常读取，coverImage 为 undefined
const legacy = timelineStore.getAll().find((r) => r.id === "legacy-001");
assert.ok(legacy, "legacy record loaded");
assert.equal(legacy.coverImage, undefined, "legacy record has no coverImage");

// 0b. setCover / setCover(null) 在旧记录上正常工作
timelineStore.setCover("legacy-001", "legacy-001/cover.png");
assert.equal(timelineStore.getAll().find((r) => r.id === "legacy-001").coverImage, "legacy-001/cover.png");
timelineStore.setCover("legacy-001", null);
const persistedLegacy = JSON.parse(backing.get("jane.timeline.v1")).find(
  (r) => r.id === "legacy-001",
);
assert.ok(!("coverImage" in persistedLegacy), "coverImage key removed entirely");
timelineStore.remove("legacy-001"); // 清掉旧记录，后续测试回到干净的三条

// 1. 新增
timelineStore.add("2026-05-16", "北京", "concert", "那天现场状态特别好。");
timelineStore.add("2025-11-08", "上海", "concert", "");
timelineStore.add("2026-08-01", "成都", "festival", "音乐节");
let all = timelineStore.getAll();
assert.equal(all.length, 3, "should have 3 records");

// 2. 日期倒序（跨年份）
assert.deepEqual(
  all.map((r) => r.date),
  ["2026-08-01", "2026-05-16", "2025-11-08"],
  "should sort newest first across years",
);

// 3. 编辑
timelineStore.update(all[2].id, { city: "上海虹桥", note: "加了备注" });
assert.equal(timelineStore.getAll()[2].city, "上海虹桥");
assert.equal(timelineStore.getAll()[2].note, "加了备注");
assert.ok(timelineStore.getAll()[2].updatedAt >= timelineStore.getAll()[2].createdAt);

// 4. 重复日期允许（同一天两场，且排在同日更早记录之前）
timelineStore.add("2026-05-16", "北京", "event", "同一天还有签售会");
all = timelineStore.getAll();
assert.equal(all.length, 4, "duplicate date allowed");
assert.equal(all[0].date, "2026-08-01", "still newest date first");
assert.equal(all[1].date, "2026-05-16");
assert.equal(all[2].date, "2026-05-16");
assert.ok(all[1].createdAt >= all[2].createdAt, "same-date entries newest first");

// 5. hasDate
assert.equal(timelineStore.hasDate("2026-05-16"), true);
assert.equal(timelineStore.hasDate("2024-01-01"), false);

// 6. 删除（删掉同一天的重复记录）
timelineStore.remove(all[1].id);
assert.equal(timelineStore.getCount(), 3, "should be 3 after delete");

// 7. 忽略状态（建议去重）
timelineStore.dismissDate("2026-08-20");
assert.equal(timelineStore.isDismissed("2026-08-20"), true);
assert.equal(timelineStore.isDismissed("2026-08-21"), false);

// 8. 重启后持久化（直接校验 localStorage 里的 JSON 内容）
const persisted = JSON.parse(backing.get("jane.timeline.v1"));
assert.ok(Array.isArray(persisted) && persisted.length === 3, "records persisted");
assert.deepEqual(
  persisted.map((r) => r.date),
  ["2026-08-01", "2026-05-16", "2025-11-08"],
  "persisted order newest first",
);
assert.ok(
  persisted.every(
    (r) => r.id && r.createdAt && r.updatedAt && "city" in r && "eventType" in r && "note" in r,
  ),
  "record shape has id/date/city/eventType/note/createdAt/updatedAt",
);
assert.deepEqual(
  JSON.parse(backing.get("jane.timeline.suggest.v1")),
  ["2026-08-20"],
  "dismiss state persisted",
);

// 9. 台词门槛（count >= 3 时第三句可选，< 3 时被过滤）
const { dialogueEngine } = await import("../src/infrastructure/DialogueEngine.ts");
const ctx = dialogueEngine.getContext();
assert.equal(ctx.timelineCount, 3, "timelineCount reflects store");
const entries = dialogueEngine.getEntries("timeline.recordAdded");
assert.equal(entries.length, 3);
const ctxLow = { timeOfDay: "morning", activity: "active", timelineCount: 2 };
const ctxHigh = { timeOfDay: "morning", activity: "active", timelineCount: 3 };
for (let i = 0; i < 50; i++) {
  const text = dialogueEngine.request("timeline.recordAdded", ctxLow);
  assert.notEqual(text, "原来已经见过这么多次了！", "third line blocked below 3 records");
}
// 3 条以上时三句都可能出现（统计层面验证即可）
let sawThird = false;
dialogueEngine.clearRecent();
for (let i = 0; i < 200; i++) {
  dialogueEngine.resetCooldowns();
  const text = dialogueEngine.request("timeline.recordAdded", ctxHigh);
  if (text === "原来已经见过这么多次了！") {
    sawThird = true;
    break;
  }
}
assert.ok(sawThird, "third line appears once count >= 3");

console.log("ALL TIMELINE TESTS PASSED");
