// Standalone data-layer test for LookSwitcherStore + pure look helpers.
import assert from "node:assert";

const backing = new Map();
globalThis.window = { addEventListener: () => {}, removeEventListener: () => {} };
globalThis.localStorage = {
  getItem: (k) => (backing.has(k) ? backing.get(k) : null),
  setItem: (k, v) => backing.set(k, String(v)),
  removeItem: (k) => backing.delete(k),
};

const { lookSwitcher } = await import("../src/infrastructure/LookSwitcherStore.ts");
const {
  pickAnotherAsset,
  resolveStartupAsset,
  validBaseAsset,
} = await import("../src/config/looks.ts");

// Fake library snapshot: lookId mirrors the category (one look per pose).
// standing=站姿, sitting=坐姿, relaxed=放松, focus=专注, concert=演出.
const assets = [
  { id: "s1", category: "standing", lookId: "standing", enabled: true },
  { id: "s2", category: "standing", lookId: "standing", enabled: true },
  { id: "b1", category: "relaxed", lookId: "relaxed", enabled: true },
  { id: "st1", category: "sitting", lookId: "sitting", enabled: true },
  { id: "f1", category: "focus", lookId: "focus", enabled: true },
  { id: "c1", category: "concert", lookId: "concert", enabled: true },
  { id: "s3", category: "standing", lookId: "standing", enabled: false }, // disabled
];

// ── 1. 换一个 ──────────────────────────────────────────────
for (let i = 0; i < 50; i++) {
  const next = pickAnotherAsset("s1", assets);
  assert.notEqual(next, "s1", "must never re-pick the current asset");
  assert.ok(["s2", "b1", "st1"].includes(next), "stays in the normal pool");
}
// Only one normal asset besides current → it is the answer.
assert.equal(pickAnotherAsset("s1", assets.filter((a) => a.id !== "b1" && a.id !== "st1")), "s2");
// Nothing else enabled → null.
assert.equal(pickAnotherAsset("s1", assets.filter((a) => a.id === "s1")), null);

// ── 2. validBaseAsset / disabled / missing fallback ───────
assert.equal(validBaseAsset("s1", assets), "s1");
assert.equal(validBaseAsset("s3", assets), null, "disabled asset is invalid");
assert.equal(validBaseAsset("ghost", assets), null, "missing asset is invalid");
assert.equal(validBaseAsset(null, assets), null);

// ── 3. 启动行为 ───────────────────────────────────────────
assert.equal(resolveStartupAsset("keepLast", assets, []), null, "keepLast defers to store");
for (let i = 0; i < 30; i++) {
  const id = resolveStartupAsset("randomDaily", assets, []);
  assert.ok(["s1", "s2"].includes(id), "randomDaily picks a standing asset");
}
// randomFavorite: only favorites, disabled favorites skipped
for (let i = 0; i < 30; i++) {
  const id = resolveStartupAsset("randomFavorite", assets, ["s2", "s3", "ghost"]);
  assert.equal(id, "s2", "randomFavorite picks only enabled favorites");
}
// No favorites → fallback to normal pool, never a special pose.
for (let i = 0; i < 30; i++) {
  const id = resolveStartupAsset("randomFavorite", assets, []);
  assert.ok(["s1", "s2", "b1", "st1"].includes(id), "favorite fallback stays normal");
}

// ── 4. Store 默认值（旧配置无字段）────────────────────────
assert.equal(lookSwitcher.getBaseAssetId(), null);
assert.equal(lookSwitcher.isLocked(), false);
assert.deepEqual(lookSwitcher.getFavorites(), []);

// ── 5. Lock / Unlock ──────────────────────────────────────
lookSwitcher.setBaseAsset("s1");
lookSwitcher.setLocked(true);
assert.equal(lookSwitcher.isLocked(), true);
lookSwitcher.setLocked(false);
assert.equal(lookSwitcher.isLocked(), false);
assert.equal(lookSwitcher.getBaseAssetId(), "s1", "unlock keeps the base");

// ── 6. Favorite ───────────────────────────────────────────
assert.equal(lookSwitcher.toggleFavorite("b1"), true);
assert.equal(lookSwitcher.isFavorite("b1"), true);
assert.equal(lookSwitcher.toggleFavorite("b1"), false);
assert.equal(lookSwitcher.isFavorite("b1"), false);

// ── 7. applyStartup ───────────────────────────────────────
lookSwitcher.setBaseAsset("st1");
let got = lookSwitcher.applyStartup("keepLast", assets);
assert.equal(got, "st1", "keepLast keeps the persisted base");
lookSwitcher.setBaseAsset("s3"); // disabled
got = lookSwitcher.applyStartup("keepLast", assets);
assert.equal(got, null, "keepLast falls back when base is disabled");
lookSwitcher.setBaseAsset("s1");
got = lookSwitcher.applyStartup("randomFavorite", assets); // favorites empty → fallback
assert.ok(got !== null, "randomFavorite never fails");
got = lookSwitcher.applyStartup("randomDaily", assets);
assert.ok(["s1", "s2"].includes(got), "randomDaily sets a standing base");

// ── 8b. pickRandomOfPose（选择造型标签随机出图）──────────
const { pickRandomOfPose } = await import("../src/config/looks.ts");
for (let i = 0; i < 30; i++) {
  const id = pickRandomOfPose("standing", assets);
  assert.ok(id === "s1" || id === "s2", "pose pick stays in pool and skips disabled");
}
assert.equal(pickRandomOfPose("concert", assets.filter((a) => a.id !== "c1")), null,
  "empty pool returns null");
assert.equal(pickRandomOfPose("focus", assets), "f1");

// ── 8. 持久化（直接校验 localStorage JSON）────────────────
const persisted = JSON.parse(backing.get("jane.look.v1"));
assert.ok("baseAssetId" in persisted && "locked" in persisted && "favoriteAssetIds" in persisted);

// ── 9. 重启（新实例读同一 backing）────────────────────────
const { lookSwitcher: fresh } = await import("../src/infrastructure/LookSwitcherStore.ts?fresh");
assert.equal(fresh.isLocked(), false, "locked state survives restart");
assert.ok(fresh.getBaseAssetId() !== null, "base asset survives restart");

console.log("ALL LOOK SWITCHER TESTS PASSED");
