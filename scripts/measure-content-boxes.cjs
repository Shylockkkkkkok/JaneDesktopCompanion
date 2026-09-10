// Measures the opaque (alpha > 8) bounding box of every Jane_pics/*.png plus
// the fallback placeholder, and emits src/config/photoContentBoxes.ts.
// Originals are never modified — this only records metadata.
const Jimp = require("jimp");
const fs = require("fs");
const path = require("path");

const ALPHA_THRESHOLD = 8;

async function measure(file) {
  const img = await Jimp.read(file);
  const { width, height, data } = img.bitmap;
  let minX = width, minY = height, maxX = -1, maxY = -1;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (data[(y * width + x) * 4 + 3] > ALPHA_THRESHOLD) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  if (maxX < 0) return null;
  return {
    width,
    height,
    contentBox: {
      x: +(minX / width).toFixed(4),
      y: +(minY / height).toFixed(4),
      w: +((maxX - minX + 1) / width).toFixed(4),
      h: +((maxY - minY + 1) / height).toFixed(4),
    },
  };
}

(async () => {
  const dir = "Jane_pics";
  const entries = {};
  let report = [];
  for (const name of fs.readdirSync(dir).filter((n) => n.endsWith(".png"))) {
    const id = name.replace(/\.png$/, "");
    const m = await measure(path.join(dir, name));
    if (m) {
      entries[id] = m;
      const c = m.contentBox;
      report.push(`${id}: ${m.width}x${m.height} content ${(c.w * 100).toFixed(0)}%w x ${(c.h * 100).toFixed(0)}%h (top pad ${(c.y * 100).toFixed(1)}%)`);
    }
  }
  const ph = await measure("src/assets/character-placeholder.png");
  if (ph) entries["character-placeholder"] = ph;

  const out = `/**
 * Opaque-content bounding boxes for the photo assets, measured from the PNG
 * alpha channel at asset-import time (scripts/measure-content-boxes.mjs) and
 * committed as data. Used to (a) tighten the character window around the
 * visible figure and (b) clip each <img>'s hit area to the visible figure
 * via clip-path. Originals are never modified.
 *
 * Coordinates are fractions of the canvas. Missing ids fall back to the full
 * canvas (x:0 y:0 w:1 h:1).
 */
export interface ContentBox {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface PhotoGeometry {
  width: number;
  height: number;
  contentBox: ContentBox;
}

export const FULL_CONTENT: ContentBox = { x: 0, y: 0, w: 1, h: 1 };

export const PHOTO_GEOMETRY: Record<string, PhotoGeometry> = ${JSON.stringify(entries, null, 2)};

export function photoGeometry(id: string): PhotoGeometry {
  return PHOTO_GEOMETRY[id] ?? { width: 1280, height: 1919, contentBox: FULL_CONTENT };
}
`;
  fs.writeFileSync("src/config/photoContentBoxes.ts", out);
  report.sort();
  console.log(report.join("\n"));
  console.log(`\nwrote src/config/photoContentBoxes.ts (${Object.keys(entries).length} entries)`);
})().catch((e) => { console.error(e); process.exit(1); });
