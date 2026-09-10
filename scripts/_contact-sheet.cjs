// Build a labeled contact sheet of all Jane_pics assets WITH their measured
// content boxes drawn, so tight/wrong boxes are visually obvious.
const Jimp = require("jimp");
const fs = require("fs");
const path = require("path");

(async () => {
  const dir = "Jane_pics";
  const names = fs.readdirSync(dir).filter((n) => n.endsWith(".png")).sort();
  const cell = 220;
  const cols = 7;
  const rows = Math.ceil(names.length / cols);
  const sheet = new Jimp(cols * cell, rows * (cell + 18), 0x303030ff);

  for (let i = 0; i < names.length; i++) {
    const name = names[i];
    const img = await Jimp.read(path.join(dir, name));
    // measured content box (alpha > 8, same as measure script)
    const { width, height, data } = img.bitmap;
    let minX = width, minY = height, maxX = -1, maxY = -1;
    for (let y = 0; y < height; y++)
      for (let x = 0; x < width; x++)
        if (data[(y * width + x) * 4 + 3] > 8) {
          if (x < minX) minX = x; if (x > maxX) maxX = x;
          if (y < minY) minY = y; if (y > maxY) maxY = y;
        }
    // thumbnail on dark background
    const thumb = img.clone().contain(cell - 8, cell - 8, Jimp.RESIZE_BICUBIC);
    const ox = (i % cols) * cell + 4;
    const oy = Math.floor(i / cols) * (cell + 18) + 4;
    compositeOnColor(thumb, ox, oy, cell - 8, cell - 8, sheet);
    // draw measured box (scaled to thumbnail placement)
    const scale = Math.min((cell - 8) / width, (cell - 8) / height);
    const tw = width * scale, th = height * scale;
    const tx = ox + (cell - 8 - tw) / 2, ty = oy + (cell - 8 - th) / 2;
    drawRect(sheet, Math.round(tx + minX * scale), Math.round(ty + minY * scale),
      Math.round((maxX - minX + 1) * scale), Math.round((maxY - minY + 1) * scale), 0xff00ffff);
    // label: tiny index bar (font bundle unavailable) — order maps to the
    // printed sorted list below.
    for (let k = 0; k <= i % cols + 1 && k < 12; k++)
      sheet.setPixelColor(0x00ff00ff, ox + 2 + k * 3, oy + cell + 6);
  }
  await sheet.writeAsync("assets-contact-sheet.png");
  console.log("wrote assets-contact-sheet.png", names.length, "assets");

  function compositeOnColor(thumb, x, y, w, h, target) {
    const bg = new Jimp(w, h, 0x000000ff);
    bg.composite(thumb, Math.floor((w - thumb.getWidth()) / 2), Math.floor((h - thumb.getHeight()) / 2));
    target.composite(bg, x, y);
  }
  function drawRect(target, x, y, w, h, color) {
    for (let i = 0; i < w; i++) { target.setPixelColor(color, x + i, y); target.setPixelColor(color, x + i, y + h - 1); }
    for (let i = 0; i < h; i++) { target.setPixelColor(color, x, y + i); target.setPixelColor(color, x + w - 1, y + i); }
  }
})().catch((e) => { console.error(e); process.exit(1); });
