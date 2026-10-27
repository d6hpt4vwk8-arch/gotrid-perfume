import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import sharp from "sharp";
const c = JSON.parse(readFileSync("ops/gallery-cache/o-candidates.json", "utf8")).filter((x: any) => x.cands.length);
mkdirSync("ops/gallery-cache/sheetsO", { recursive: true });
const T = 230, PER = 6, COLS = 8, H = 34;
const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;");
(async () => {
  for (let s = 0; s * PER < c.length; s++) {
    const grp = c.slice(s * PER, (s + 1) * PER);
    const W = T * COLS, HH = grp.length * (T + H);
    const layers: any[] = [];
    for (let r = 0; r < grp.length; r++) {
      const x = grp[r];
      const label = `${x.code} | ${x.name.slice(0, 60)}  <=  ${String(x.matched).slice(0, 55)}`;
      layers.push({ input: Buffer.from(`<svg width="${W}" height="${H}"><rect width="100%" height="100%" fill="#fff"/><text x="4" y="22" font-size="17" font-family="Arial" fill="#000">${esc(label)}</text></svg>`), top: r * (T + H), left: 0 });
      for (let i = 0; i < Math.min(x.cands.length, COLS); i++) {
        const img = await sharp(x.cands[i].file).resize(T - 6, T - 30, { fit: "contain", background: "#fff" }).extend({ bottom: 24, background: "#fff" }).toBuffer();
        layers.push({ input: img, top: r * (T + H) + H, left: i * T });
        layers.push({ input: Buffer.from(`<svg width="${T}" height="22"><text x="${T / 2}" y="18" font-size="20" font-weight="bold" font-family="Arial" fill="#c00" text-anchor="middle">${i + 1}</text></svg>`), top: r * (T + H) + H + T - 24, left: i * T });
      }
    }
    await sharp({ create: { width: W, height: HH, channels: 3, background: "#fff" } }).composite(layers).jpeg({ quality: 80 }).toFile(`ops/gallery-cache/sheetsO/o-${String(s + 1).padStart(2, "0")}.jpg`);
  }
  console.log("sheets", Math.ceil(c.length / PER));
})();
