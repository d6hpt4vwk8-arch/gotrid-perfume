// Splits a Gemini 2x2 contact sheet (4 product renders on white, numbered 1..4) into square 900 px product images.
// usage: npx tsx scripts/_split-gemini-grid.ts <grid.jpeg> name1[:rot] name2[:rot] name3[:rot] name4[:rot]
import sharp from "sharp";
const out = "/Users/pavlogrican/Desktop/Gotrid Perfume co work Claude/ops/gift-images/2026-11-gemini";

async function panel(src: string, qx: number, qy: number, cw: number, chh: number, rot: number, dest: string) {
  const { data, info } = await sharp(src).extract({ left: qx, top: qy, width: cw, height: chh }).raw().toBuffer({ resolveWithObject: true });
  const w = info.width, h = info.height, ch = info.channels;
  let x0 = w, y0 = h, x1 = 0, y1 = 0;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    if (x < 230 && y < 200) continue; // the "1".."4" label in the cell corner
    if (x < 14 || y < 14 || x > w - 14 || y > h - 14) continue; // grid divider lines
    const i = (y * w + x) * ch;
    if (Math.min(data[i], data[i + 1], data[i + 2]) < 225) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  }
  const pad = Math.round(Math.max(x1 - x0, y1 - y0) * 0.07);
  const left = Math.max(0, x0 - pad), top = Math.max(0, y0 - pad);
  const width = Math.min(w - left, x1 - x0 + 2 * pad), height = Math.min(h - top, y1 - y0 + 2 * pad);
  let img = sharp(src).extract({ left: qx + left, top: qy + top, width, height });
  if (rot) img = sharp(await img.rotate(rot, { background: "#ffffff" }).toBuffer());
  await img.resize({ width: 860, height: 860, fit: "inside" }).extend({ top: 20, bottom: 20, left: 20, right: 20, background: "#ffffff" })
    .resize({ width: 900, height: 900, fit: "contain", background: "#ffffff" }).flatten({ background: "#ffffff" }).jpeg({ quality: 92 }).toFile(dest);
}

(async () => {
  const [src, ...names] = process.argv.slice(2);
  const meta = await sharp(src).metadata();
  const half = Math.floor(meta.width! / 2);
  const halfH = Math.floor(meta.height! / 2);
  for (let i = 0; i < names.length; i++) {
    const [name, rot] = names[i].split(":");
    if (!name || name === "-") continue;
    await panel(src, (i % 2) * half, Math.floor(i / 2) * halfH, half, halfH, rot ? Number(rot) : 0, `${out}/${name}.jpg`);
    console.log("wrote", name);
  }
})();
