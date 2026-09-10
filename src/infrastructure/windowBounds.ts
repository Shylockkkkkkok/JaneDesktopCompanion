import type { ContentBox } from "../config/photoContentBoxes";
import { FULL_CONTENT } from "../config/photoContentBoxes";

export { FULL_CONTENT };

/**
 * Pure geometry for the compact character window. All inputs/outputs are in
 * logical CSS pixels unless a field name says Physical. Kept dependency-free
 * so it can be unit-tested in Node (scripts/test-window-bounds.mjs).
 *
 * IMPORTANT (drift safety): the window is ALWAYS laid out from a stored
 * screen anchor (the content's bottom-center point), never re-derived from
 * the current window bounds. Deriving from the current window reintroduces
 * the layout's canvas-centering offset every iteration and the window would
 * drift forever — that was the "Jane moves by herself" bug.
 */

export interface Rect {
  left: number;
  top: number;
  width: number;
  height: number;
}

export interface PhysicalBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface WindowMargins {
  /** Horizontal margin on each side of the content. */
  x: number;
  /** Margin above the content (hover lift / reaction overflow). */
  top: number;
  /** Margin below the content (Jane's feet sit this far above the edge). */
  bottom: number;
}

/**
 * Safety margins around the visible figure. The bubble lives in its own
 * window now, so the top margin only has to absorb hover/reaction motion.
 */
export const CHARACTER_WINDOW_MARGINS: WindowMargins = { x: 16, top: 20, bottom: 4 };

/** Fallback monitor info when no monitor could be resolved. */
export const FALLBACK_SCALE_FACTOR = 1;

/**
 * Where the visible (alpha > 0) content sits inside a window of the given
 * logical size. Layout mirrors the render chain: img centered horizontally,
 * bottom-aligned (`flex-end`), then translated by the photo's calibrated
 * offsets, then the content box fractions applied within the img canvas.
 */
export function contentRectInWindow(opts: {
  imgWidth: number;
  imgHeight: number;
  contentBox: ContentBox;
  offsetX: number;
  offsetY: number;
  windowWidth: number;
  windowHeight: number;
}): Rect {
  const imgLeft = (opts.windowWidth - opts.imgWidth) / 2 + opts.offsetX;
  const imgTop = opts.windowHeight - opts.imgHeight + opts.offsetY;
  const cb = opts.contentBox;
  return {
    left: imgLeft + cb.x * opts.imgWidth,
    top: imgTop + cb.y * opts.imgHeight,
    width: cb.w * opts.imgWidth,
    height: cb.h * opts.imgHeight,
  };
}

export interface MonitorBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface CompactWindowResult extends PhysicalBounds {
  /**
   * The content's bottom-center point on screen AFTER monitor clamping.
   * Store this back as the anchor — when the window is pushed against a
   * screen edge, the anchor must follow, or the next layout would try to
   * restore the unclamped position and oscillate.
   */
  contentAnchorX: number;
  contentAnchorY: number;
}

/**
 * Lay out the compact window that hugs the visible figure:
 *
 *   size   = content + margins (or the optional minimums, whichever larger —
 *            used while an in-window overlay like the context menu is open)
 *   place  = the content's bottom-center lands exactly on the given anchor
 *   clamp  = keep the window inside the monitor it lives on
 *
 * Deterministic: identical inputs always produce identical bounds, so a
 * re-layout with unchanged inputs is a no-op (no drift).
 */
export function layoutCompactWindow(opts: {
  imgWidth: number;
  imgHeight: number;
  contentBox: ContentBox;
  offsetX: number;
  offsetY: number;
  /** Screen point (physical) where the content's bottom-center should sit. */
  anchorX: number;
  anchorY: number;
  scaleFactor: number;
  margins?: WindowMargins;
  monitor: MonitorBox | null;
  /** Minimum logical window size (e.g. while the context menu is open). */
  minWidthL?: number;
  minHeightL?: number;
}): CompactWindowResult {
  const s = opts.scaleFactor;
  const m = opts.margins ?? CHARACTER_WINDOW_MARGINS;
  const cb = opts.contentBox ?? FULL_CONTENT;

  const contentWL = cb.w * opts.imgWidth;
  const contentHL = cb.h * opts.imgHeight;

  // Layout constants, independent of the window size:
  //   contentLeft = widthL / 2 + A   (img centered, then calibrated offset)
  //   contentTop  = heightL - B      (img bottom-anchored, then offset)
  // The window must be large enough that the content rect (INCLUDING the
  // user's calibrated offsets — possibly large negatives from Asset Lab)
  // stays inside the margins. Solving the two constraints per axis:
  const A = opts.offsetX + (cb.x - 0.5) * opts.imgWidth;
  const B = opts.imgHeight * (1 - cb.y) - opts.offsetY;
  const widthL = Math.max(
    contentWL + 2 * m.x,
    2 * (m.x - A),
    2 * (A + contentWL + m.x),
    opts.minWidthL ?? 0,
  );
  const heightL = Math.max(
    contentHL + m.top + m.bottom,
    m.top + B,
    opts.minHeightL ?? 0,
  );
  const width = Math.max(1, Math.round(widthL * s));
  const height = Math.max(1, Math.round(heightL * s));

  // Content position inside the NEW window (same layout chain as render).
  const imgLeft = (widthL - opts.imgWidth) / 2 + opts.offsetX;
  const imgTop = heightL - opts.imgHeight + opts.offsetY;
  const contentCenterXL = imgLeft + (cb.x + cb.w / 2) * opts.imgWidth;
  const contentBottomYL = imgTop + (cb.y + cb.h) * opts.imgHeight;

  let x = Math.round(opts.anchorX - contentCenterXL * s);
  let y = Math.round(opts.anchorY - contentBottomYL * s);

  const mon = opts.monitor;
  if (mon && mon.width > 0 && mon.height > 0) {
    if (width < mon.width) {
      x = Math.min(Math.max(x, mon.x), mon.x + mon.width - width);
    }
    if (height < mon.height) {
      y = Math.min(Math.max(y, mon.y), mon.y + mon.height - height);
    }
  }

  return {
    x,
    y,
    width,
    height,
    contentAnchorX: x + contentCenterXL * s,
    contentAnchorY: y + contentBottomYL * s,
  };
}

/** True when two physical bounds are effectively identical (±1 px). */
export function boundsAlmostEqual(
  a: PhysicalBounds,
  b: PhysicalBounds,
): boolean {
  return (
    Math.abs(a.x - b.x) <= 1 &&
    Math.abs(a.y - b.y) <= 1 &&
    Math.abs(a.width - b.width) <= 1 &&
    Math.abs(a.height - b.height) <= 1
  );
}

// ── Speech bubble placement ───────────────────────────────

export type BubbleSide = "left" | "right" | "top";

/**
 * Place the bubble overlay window so it NEVER overlaps the visible figure
 * and stays on the monitor when possible.
 *
 * Candidates (preferred side first, then the others): each is clamped into
 * the monitor and then checked for intersection with the figure's on-screen
 * rect (+ gap). The first non-overlapping candidate wins. Only when no such
 * position exists (screen fully occupied) do we fall back to the preferred
 * side — the bubble window re-asserts always-on-top, so it may overlap but
 * is never hidden BEHIND the character.
 */
export function placeBubbleWindow(opts: {
  /** Current character window bounds (physical). */
  windowBounds: PhysicalBounds;
  /** Content (visible figure) rect in CURRENT window coordinates (logical). */
  contentRect: Rect;
  scaleFactor: number;
  monitor: MonitorBox | null;
  /** Bubble overlay window size (physical). */
  bubbleWidth: number;
  bubbleHeight: number;
  preferredSide: BubbleSide;
  /** Gap between bubble and figure (physical), default 8. */
  gap?: number;
}): { x: number; y: number; side: BubbleSide } {
  const s = opts.scaleFactor;
  const gap = opts.gap ?? 8;
  const wb = opts.windowBounds;
  const cr = opts.contentRect;
  const bw = opts.bubbleWidth;
  const bh = opts.bubbleHeight;

  // Figure rect on screen (physical).
  const fig = {
    left: wb.x + cr.left * s,
    top: wb.y + cr.top * s,
    width: cr.width * s,
    height: cr.height * s,
  };
  const figRight = fig.left + fig.width;
  const figBottom = fig.top + fig.height;
  const contentTopScreen = fig.top;
  const contentCenterX = fig.left + fig.width / 2;

  const mon = opts.monitor;
  const clampX = (x: number): number =>
    mon && mon.width > 0 && bw < mon.width
      ? Math.min(Math.max(x, mon.x), mon.x + mon.width - bw)
      : x;
  const clampY = (y: number): number =>
    mon && mon.height > 0 && bh < mon.height
      ? Math.min(Math.max(y, mon.y), mon.y + mon.height - bh)
      : y;

  // Does the bubble stage intersect the figure (+ gap on every side)?
  const intersectsFigure = (x: number, y: number): boolean =>
    x < figRight + gap &&
    x + bw > fig.left - gap &&
    y < figBottom + gap &&
    y + bh > fig.top - gap;

  const candidates: { side: BubbleSide; x: number; y: number }[] = [
    // Above the head: entire stage sits above the content's top edge.
    {
      side: "top",
      x: clampX(Math.round(contentCenterX - bw / 2)),
      y: clampY(Math.round(contentTopScreen - gap - bh)),
    },
    // Beside the window: the stage is fully outside the window, so it can
    // only overlap the figure if the monitor clamp pushed it back.
    {
      side: "left",
      x: clampX(Math.round(wb.x - bw)),
      y: clampY(Math.round(contentTopScreen - 14 * s)),
    },
    {
      side: "right",
      x: clampX(Math.round(wb.x + wb.width)),
      y: clampY(Math.round(contentTopScreen - 14 * s)),
    },
  ];

  const ordered: BubbleSide[] = [
    opts.preferredSide,
    ...(["top", "left", "right"] as const).filter((s2) => s2 !== opts.preferredSide),
  ];
  for (const side of ordered) {
    const c = candidates.find((c2) => c2.side === side)!;
    if (!intersectsFigure(c.x, c.y)) {
      return { x: c.x, y: c.y, side };
    }
  }
  // No non-overlapping position exists — keep the preferred side. The bubble
  // window re-asserts always-on-top so it is never behind the character.
  const fallback =
    candidates.find((c) => c.side === opts.preferredSide) ?? candidates[0];
  return { x: fallback.x, y: fallback.y, side: fallback.side };
}

/**
 * Clamp a calibrated vertical offset so the visible content can never be
 * pushed below the window's bottom margin. The render chain pins the img
 * bottom to the window bottom — a positive offsetY beyond the canvas's own
 * bottom padding would push the figure's feet out of the window no matter
 * how tall the window is, so the effective offset (used by BOTH the render
 * transform and the window layout) is capped here.
 */
export function clampVerticalOffset(
  offsetY: number,
  imgHeight: number,
  contentBox: ContentBox,
  marginBottom: number,
): number {
  const bottomPad = imgHeight * (1 - contentBox.y - contentBox.h);
  return Math.min(offsetY, bottomPad - marginBottom);
}

/**
 * clip-path that cuts an <img> down to its visible content, so hover/click
 * inside the webview follows the figure instead of the transparent canvas.
 */
export function clipPathFor(contentBox: ContentBox): string {
  const cb = contentBox ?? FULL_CONTENT;
  const top = cb.y * 100;
  const left = cb.x * 100;
  const right = (1 - cb.x - cb.w) * 100;
  const bottom = (1 - cb.y - cb.h) * 100;
  return `inset(${top.toFixed(2)}% ${right.toFixed(2)}% ${bottom.toFixed(2)}% ${left.toFixed(2)}%)`;
}
