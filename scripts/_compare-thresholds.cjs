const Jimp = require("jimp");
const fs = require("fs");
const path = require("path");

// Compare content bbox at different alpha thresholds for every asset:
// if alpha>1 reaches higher than alpha>8, the old measurement clipped hair.
(async () => {
  const dir = "Jane_pics";
  for (const name of fs.readdirSync(dir).filter((n) => n.endsWith(".png"))) {
    const img = await Jimp.read(path.join(dir, name));
    const { width, height, data } = img.bitmap;
    const boxes = {};
    for (const t of [1, 8]) {
      let minX = width, minY = height, maxX = -1, maxY = -1;
      for (let y = 0; y < height; y++)
        for (let x = 0; x < width; x++)
          if (data[(y * width + x) * 4 + 3] > t) {
            if (x < minX) minX = x;
            if (x > maxX) maxX = x;
            if (y < minY) minY = y;
            if (y > maxY) maxY = y;
          }
      boxes[t] = { topPx: minY, bottomPx: maxY, leftPx: minX, rightPx: maxX };
    }
    const dTop = boxes[8].topPx - boxes[1].topPx;
    const dBot = boxes[1].bottomPx - boxes[8].bottomPx;
    const dL = boxes[8].leftPx - boxes[1].leftPx;
    const dR = boxes[1].rightPx - boxes[8].rightPx;
    if (dTop > 0 || dBot > 0 || dL > 0 || dR > 0) {
      console.log(
        `${name}: faint-margin px → top:${dTop} bottom:${dBot} left:${dL} right:${dR} (canvas ${width}x${height})`,
      );
    }
  }
})().catch((e) => { console.error(e); process.exit(1); });
