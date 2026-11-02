import sharp from "sharp";
const dir = "/private/tmp/claude-501/-Users-pavlogrican-Desktop-Gotrid-Perfume-co-work-Claude/b995ed99-fe60-4325-b060-fcf5dae00967/scratchpad/gifts";
const out = "/Users/pavlogrican/Desktop/Gotrid Perfume co work Claude/ops/gift-images/2026-11";
const files: Record<string, string> = {
  "tiger-gel": "2737", "snake-serum": "2738", "cannadream": "2740", "cannaprotect": "2742",
  "mizon-collagen": "2744", "mizon-hyalugen": "2746", "vvbetter-teca": "2748", "dralthea-aqua": "2750",
  "iconique-mask": "2752", "iconique-shampoo": "2762", "village11-aha": "2754", "scent-lyra": "2756",
  "rabanne-parfum": "2758", "rabanne-edt": "2760", "skin1004-oil": "2764", "vvbetter-sun": "2768",
  "vvbetter-eye": "2776", "garnier-mask": "2778", "curaprox-interdental": "2770", "curaprox-brush": "2780", "zymbion": "2781",
};

// The photos are an object on a light desk with a soft gradient, so a fixed background colour does not work:
// compare each pixel with a heavily blurred copy of the image and keep what stands out from it.
async function objectBox(src: string) {
  const W = 420;
  const base = sharp(src).rotate().resize({ width: W }).greyscale();
  const { data, info } = await base.clone().raw().toBuffer({ resolveWithObject: true });
  const blur = await base.clone().blur(35).raw().toBuffer();
  const w = info.width, h = info.height;
  const colHits = new Array(w).fill(0), rowHits = new Array(h).fill(0);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    if (Math.abs(data[y * w + x] - blur[y * w + x]) > 14) { colHits[x]++; rowHits[y]++; }
  }
  const first = (arr: number[], min: number) => arr.findIndex((v) => v >= min);
  const last = (arr: number[], min: number) => arr.length - 1 - [...arr].reverse().findIndex((v) => v >= min);
  const minCol = Math.max(6, h * 0.02), minRow = Math.max(6, w * 0.02);
  return { x0: first(colHits, minCol) / w, x1: (last(colHits, minCol) + 1) / w, y0: first(rowHits, minRow) / h, y1: (last(rowHits, minRow) + 1) / h };
}

// Hand-set boxes (px in the 1050-wide converted photos) where the automatic detection fails.
const MANUAL: Record<string, [number, number, number, number]> = {
  "scent-lyra": [200, 270, 640, 930],
  "iconique-shampoo": [260, 150, 470, 1060],
  "vvbetter-eye": [220, 420, 600, 600],
  "garnier-mask": [80, 140, 890, 1210],
  "curaprox-interdental": [170, 180, 660, 1000],
  "curaprox-brush": [300, 150, 400, 1140],
  "zymbion": [360, 210, 470, 1030],
  "dralthea-aqua": [90, 470, 920, 490],
};

(async () => {
  for (const [name, n] of Object.entries(files)) {
    const src = `${dir}/img_${n}.jpg`;
    const rotated = await sharp(src).rotate().toBuffer();
    const meta = await sharp(rotated).metadata();
    const W = meta.width!, H = meta.height!;
    if (MANUAL[name]) {
      const [l, t, w, h] = MANUAL[name];
      await sharp(rotated).extract({ left: l, top: t, width: Math.min(w, W - l), height: Math.min(h, H - t) })
        .resize({ width: 900, height: 900, fit: "contain", background: "#f4f4f2" })
        .flatten({ background: "#f4f4f2" }).jpeg({ quality: 88 }).toFile(`${out}/${name}.jpg`);
      console.log(name, "manual");
      continue;
    }
    const b = await objectBox(src);
    const padX = (b.x1 - b.x0) * 0.08, padY = (b.y1 - b.y0) * 0.08;
    const left = Math.max(0, Math.round((b.x0 - padX) * W)), top = Math.max(0, Math.round((b.y0 - padY) * H));
    const width = Math.min(W - left, Math.round((b.x1 - b.x0 + 2 * padX) * W)), height = Math.min(H - top, Math.round((b.y1 - b.y0 + 2 * padY) * H));
    await sharp(rotated).extract({ left, top, width, height })
      .resize({ width: 900, height: 900, fit: "contain", background: "#f4f4f2" })
      .flatten({ background: "#f4f4f2" }).jpeg({ quality: 88 }).toFile(`${out}/${name}.jpg`);
    console.log(name, `${left},${top} ${width}x${height}`);
  }
})();
