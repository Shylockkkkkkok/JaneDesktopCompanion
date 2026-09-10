// Unit tests for the compact-window geometry (infrastructure/windowBounds).
// Key properties:
//   1. layoutCompactWindow is DETERMINISTIC and anchor-based — identical
//      inputs always produce identical bounds (no drift).
//   2. The content rect (INCLUDING user-calibrated offsets, which may be
//      large negatives from Asset Lab) always lands fully inside the window
//      margins — head / sides are never clipped, whatever the calibration.
import assert from "node:assert";

const {
  contentRectInWindow,
  layoutCompactWindow,
  boundsAlmostEqual,
  clipPathFor,
  clampVerticalOffset,
  placeBubbleWindow,
  CHARACTER_WINDOW_MARGINS,
} = await import("../src/infrastructure/windowBounds.ts");
const { photoGeometry, PHOTO_GEOMETRY } = await import(
  "../src/config/photoContentBoxes.ts"
);

const M = CHARACTER_WINDOW_MARGINS;

// ── 1. contentRectInWindow: layout mirrors the render chain ──
const full = { x: 0, y: 0, w: 1, h: 1 };
let r = contentRectInWindow({
  imgWidth: 200, imgHeight: 300, contentBox: full,
  offsetX: 0, offsetY: 0, windowWidth: 300, windowHeight: 380,
});
assert.deepEqual(r, { left: 50, top: 80, width: 200, height: 300 });

r = contentRectInWindow({
  imgWidth: 200, imgHeight: 300,
  contentBox: { x: 0.1, y: 0.2, w: 0.5, h: 0.6 },
  offsetX: 10, offsetY: -4, windowWidth: 300, windowHeight: 380,
});
assert.equal(r.left, 50 + 10 + 0.1 * 200);
assert.equal(r.top, 380 - 300 - 4 + 0.2 * 300);
assert.equal(r.width, 100);
assert.equal(r.height, 180);

// ── invariant helper: content must sit fully inside the margins ──
function assertContains(b, layout, label) {
  // b.width/b.height are integer physical px; at scale 1 they are logical.
  const rect = contentRectInWindow({
    imgWidth: layout.imgWidth,
    imgHeight: layout.imgHeight,
    contentBox: layout.contentBox,
    offsetX: layout.offsetX,
    offsetY: layout.offsetY,
    windowWidth: b.width,
    windowHeight: b.height,
  });
  assert.ok(rect.left >= M.x - 1, `${label}: left margin (got ${rect.left})`);
  assert.ok(
    rect.left + rect.width <= b.width - M.x + 1,
    `${label}: right margin (right=${rect.left + rect.width}, win=${b.width})`,
  );
  assert.ok(rect.top >= M.top - 1, `${label}: head not cut (top=${rect.top})`);
  assert.ok(
    rect.top + rect.height <= b.height - M.bottom + 1,
    `${label}: bottom margin`,
  );
}

// ── 2. Window fits content + margins (b6, zero offsets) ──
const b6 = photoGeometry("b6_transparent"); // widest top padding (23.6%)
const layout = {
  imgWidth: 240, imgHeight: 300,
  contentBox: b6.contentBox,
  offsetX: 0, offsetY: 0,
};
const ANCHOR = { x: 1000, y: 2000 };
const b = layoutCompactWindow({ ...layout, anchorX: ANCHOR.x, anchorY: ANCHOR.y, scaleFactor: 1, monitor: null });
assertContains(b, layout, "b6 zero offsets");
// Width must ALSO account for off-center content (constraint can exceed
// contentW + 2·margins).
assert.ok(b.width >= Math.round(b6.contentBox.w * 240) + 2 * M.x, "at least content+margins wide");

// ── 3. Anchor: content bottom-center lands on the anchor ──
const imgLeft = (b.width - 240) / 2;
const imgTop = b.height - 300;
const cCx = imgLeft + (b6.contentBox.x + b6.contentBox.w / 2) * 240;
const cBy = imgTop + (b6.contentBox.y + b6.contentBox.h) * 300;
assert.ok(Math.abs(b.x + cCx - ANCHOR.x) <= 1, "bottom-center X anchored");
assert.ok(Math.abs(b.y + cBy - ANCHOR.y) <= 1, "bottom-center Y anchored");
assert.ok(Math.abs(b.contentAnchorX - ANCHOR.x) <= 1);
assert.ok(Math.abs(b.contentAnchorY - ANCHOR.y) <= 1);

// ── 4. DRIFT REGRESSION: relayout from the achieved anchor is a no-op ──
let cur = { ...b };
for (let i = 0; i < 10; i++) {
  const next = layoutCompactWindow({
    ...layout,
    anchorX: cur.contentAnchorX,
    anchorY: cur.contentAnchorY,
    scaleFactor: 1,
    monitor: null,
  });
  assert.ok(boundsAlmostEqual(next, cur), `iteration ${i} stable`);
  cur = next;
}
assert.deepEqual({ x: cur.x, y: cur.y }, { x: b.x, y: b.y }, "no drift after 10 relayouts");

// ── 5. CLIPPING REGRESSIONS (old window cut these) ──
// 5a. Negative offsetY (photo calibrated upward) must not cut the head.
const headLayout = {
  imgWidth: 240, imgHeight: 300,
  contentBox: { x: 0.1, y: 0.2, w: 0.5, h: 0.6 },
  offsetX: 0, offsetY: -80,
};
const head = layoutCompactWindow({ ...headLayout, anchorX: 500, anchorY: 900, scaleFactor: 1, monitor: null });
assertContains(head, headLayout, "negative offsetY");

// 5b. Negative offsetX (photo calibrated leftward) must not cut the left side.
const leftLayout = {
  imgWidth: 240, imgHeight: 300,
  contentBox: { x: 0.1, y: 0.2, w: 0.5, h: 0.6 },
  offsetX: -60, offsetY: 0,
};
const left = layoutCompactWindow({ ...leftLayout, anchorX: 500, anchorY: 900, scaleFactor: 1, monitor: null });
assertContains(left, leftLayout, "negative offsetX");

// 5c. Off-center content (canvas content on the right, e.g. b9-like 39% w)
// with zero offsets: the wider side gets room.
const offCenter = {
  imgWidth: 240, imgHeight: 300,
  contentBox: { x: 0.55, y: 0.1, w: 0.39, h: 0.85 },
  offsetX: 0, offsetY: 0,
};
const oc = layoutCompactWindow({ ...offCenter, anchorX: 500, anchorY: 900, scaleFactor: 1, monitor: null });
assertContains(oc, offCenter, "off-center content");

// 5d. Real assets × a sweep of harsh calibrations: never clip.
// Vertical offsets are normalized first (same clamp the renderer applies) —
// a raw +30 would push the img below the window bottom by design.
const harsh = [-80, -40, -20, 0, 20, 40];
for (const [id, geom] of Object.entries(PHOTO_GEOMETRY)) {
  for (const rawOffX of harsh) {
    for (const rawOffY of [-40, 0, 30]) {
      const imgHeight = 280;
      const offX = rawOffX;
      const offY = clampVerticalOffset(rawOffY, imgHeight, geom.contentBox, M.bottom);
      const L = {
        imgWidth: 200, imgHeight,
        contentBox: geom.contentBox,
        offsetX: offX, offsetY: offY,
      };
      const w = layoutCompactWindow({ ...L, anchorX: 0, anchorY: 0, scaleFactor: 1, monitor: null });
      assertContains(w, L, `${id} offX=${rawOffX} offY=${rawOffY}`);
    }
  }
}

// 5e. clampVerticalOffset: caps at bottomPad − margin, keeps negatives.
assert.ok(Math.abs(clampVerticalOffset(30, 280, { x: 0, y: 0.076, w: 0.91, h: 0.91 }, 4) - (280 * 0.014 - 4)) < 1e-9);
assert.equal(clampVerticalOffset(-80, 280, { x: 0, y: 0.076, w: 0.91, h: 0.91 }, 4), -80);
assert.equal(clampVerticalOffset(0, 280, full, 4), -4, "full-box video: max 0 goes to -margin");

// ── 6. DPI: physical scaling keeps the same screen anchor ──
const s = 1.5;
const b15 = layoutCompactWindow({ ...layout, anchorX: 1500, anchorY: 3000, scaleFactor: s, monitor: null });
assert.ok(Math.abs(b15.contentAnchorX - 1500) <= 1.5, "DPI anchor X");
assert.ok(Math.abs(b15.contentAnchorY - 3000) <= 1.5, "DPI anchor Y");
assert.ok(b15.width > b.width, "DPI window physically larger");

// ── 7. Monitor clamping keeps the window on screen AND moves the anchor ──
const clamped = layoutCompactWindow({
  ...layout,
  anchorX: 30, anchorY: 30,
  scaleFactor: 1,
  monitor: { x: 0, y: 0, width: 1920, height: 1080 },
});
assert.ok(clamped.x >= 0 && clamped.x + clamped.width <= 1920, "x clamped");
assert.ok(clamped.y >= 0 && clamped.y + clamped.height <= 1080, "y clamped");
const clamped2 = layoutCompactWindow({
  ...layout,
  anchorX: clamped.contentAnchorX,
  anchorY: clamped.contentAnchorY,
  scaleFactor: 1,
  monitor: { x: 0, y: 0, width: 1920, height: 1080 },
});
assert.ok(boundsAlmostEqual(clamped2, clamped), "clamped state is stable");

// ── 8. boundsAlmostEqual tolerance ──
assert.equal(boundsAlmostEqual({ x: 10, y: 10, width: 100, height: 100 }, { x: 11, y: 9, width: 101, height: 100 }), true);
assert.equal(boundsAlmostEqual({ x: 10, y: 10, width: 100, height: 100 }, { x: 12, y: 10, width: 100, height: 100 }), false);

// ── 9. clipPathFor ──
assert.equal(clipPathFor(full), "inset(0.00% 0.00% 0.00% 0.00%)");
assert.equal(clipPathFor({ x: 0.1, y: 0.2, w: 0.5, h: 0.6 }), "inset(20.00% 40.00% 20.00% 10.00%)");

// ── 10. Menu expansion: minimums widen the window, anchor holds ──
const expanded = layoutCompactWindow({
  ...layout,
  anchorX: ANCHOR.x, anchorY: ANCHOR.y,
  scaleFactor: 1, monitor: null,
  minWidthL: 300, minHeightL: 296,
});
assert.ok(expanded.width >= 300 && expanded.height >= 296, "menu-expanded size");
assert.ok(Math.abs(expanded.contentAnchorX - ANCHOR.x) <= 1, "expanded anchor X");
assert.ok(Math.abs(expanded.contentAnchorY - ANCHOR.y) <= 1, "expanded anchor Y");
assert.equal(expanded.y + expanded.height, b.y + b.height, "bottom edge fixed");
assert.ok(
  boundsAlmostEqual(
    layoutCompactWindow({ ...layout, anchorX: expanded.contentAnchorX, anchorY: expanded.contentAnchorY, scaleFactor: 1, monitor: null, minWidthL: 300, minHeightL: 296 }),
    expanded,
  ),
  "expanded state stable",
);

// ── 11. placeBubbleWindow: never overlaps the figure ──
const FIG = { left: 60, top: 20, width: 180, height: 260 };
const WIN = { x: 800, y: 600, width: 300, height: 320 };
const screenFig = {
  left: WIN.x + FIG.left, top: WIN.y + FIG.top,
  width: FIG.width, height: FIG.height,
};
const overlap = (p) =>
  p.x < screenFig.left + screenFig.width + 8 &&
  p.x + 380 > screenFig.left - 8 &&
  p.y < screenFig.top + screenFig.height + 8 &&
  p.y + 300 > screenFig.top - 8;

const above = placeBubbleWindow({
  windowBounds: WIN, contentRect: FIG, scaleFactor: 1,
  monitor: { x: 0, y: 0, width: 1920, height: 1080 },
  bubbleWidth: 380, bubbleHeight: 300, preferredSide: "top",
});
assert.equal(above.side, "top");
assert.equal(overlap(above), false, "top: no overlap");
assert.ok(above.y + 300 <= screenFig.top - 8 + 1, "top: fully above figure");

const atTop = placeBubbleWindow({
  windowBounds: { x: 800, y: 0, width: 300, height: 320 }, contentRect: FIG, scaleFactor: 1,
  monitor: { x: 0, y: 0, width: 1920, height: 1080 },
  bubbleWidth: 380, bubbleHeight: 300, preferredSide: "top",
});
assert.equal(atTop.side !== "top", true, "falls back when no room above");
assert.equal(overlap(atTop), false, "fallback: no overlap");

const atLeft = placeBubbleWindow({
  windowBounds: { x: 0, y: 500, width: 300, height: 320 }, contentRect: FIG, scaleFactor: 1,
  monitor: { x: 0, y: 0, width: 1920, height: 1080 },
  bubbleWidth: 380, bubbleHeight: 300, preferredSide: "left",
});
assert.equal(atLeft.side !== "left", true, "left-edge: falls back");
assert.equal(overlap(atLeft), false, "left-edge: no overlap");

const tiny = placeBubbleWindow({
  windowBounds: { x: 60, y: 60, width: 300, height: 320 }, contentRect: FIG, scaleFactor: 1,
  monitor: { x: 0, y: 0, width: 400, height: 420 },
  bubbleWidth: 380, bubbleHeight: 300, preferredSide: "top",
});
assert.equal(tiny.side, "top", "degenerate falls back to preferred side");
assert.ok(tiny.x >= 0 && tiny.x + 380 <= 400, "degenerate still clamped to screen");

// ── 12. All measured assets have sane content boxes ──
for (const [id, g] of Object.entries(PHOTO_GEOMETRY)) {
  const c = g.contentBox;
  assert.ok(c.w > 0 && c.h > 0 && c.x >= 0 && c.y >= 0 && c.x + c.w <= 1.0001 && c.y + c.h <= 1.0001, `${id} sane`);
  assert.ok(g.width > 0 && g.height > 0, `${id} dims`);
}

console.log("ALL WINDOW BOUNDS TESTS PASSED");
