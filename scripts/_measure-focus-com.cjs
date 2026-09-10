const J = require("jimp");
(async () => {
  const i = await J.read("focus/focus_com.png");
  const b = i.bitmap;
  let minX = b.width, minY = b.height, maxX = -1, maxY = -1;
  for (let y = 0; y < b.height; y++)
    for (let x = 0; x < b.width; x++)
      if (b.data[(y * b.width + x) * 4 + 3] > 8) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
  console.log("bbox px", { minX, minY, w: maxX - minX + 1, h: maxY - minY + 1 });
  console.log("fractions", JSON.stringify({
    x: +(minX / b.width).toFixed(4),
    y: +(minY / b.height).toFixed(4),
    w: +((maxX - minX + 1) / b.width).toFixed(4),
    h: +((maxY - minY + 1) / b.height).toFixed(4),
  }));
})().catch((e) => { console.error(e); process.exit(1); });
