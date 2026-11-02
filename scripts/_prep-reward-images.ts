import sharp from "sharp";
const web = "/private/tmp/claude-501/-Users-pavlogrican-Desktop-Gotrid-Perfume-co-work-Claude/b995ed99-fe60-4325-b060-fcf5dae00967/scratchpad/web";
const out = "/Users/pavlogrican/Desktop/Gotrid Perfume co work Claude/ops/gift-images/2026-11";
(async () => {
  // Brush: Gemini render on a white background, trim to the object and put it on a 900 px square.
  const brush = await sharp(`${web}/brush-gemini.jpeg`).trim({ threshold: 12 }).toBuffer();
  await sharp(brush).resize({ width: 800, height: 800, fit: "inside" }).extend({ top: 50, bottom: 50, left: 50, right: 50, background: "#ffffff" })
    .resize({ width: 900, height: 900, fit: "contain", background: "#ffffff" }).flatten({ background: "#ffffff" }).jpeg({ quality: 90 }).toFile(`${out}/curaprox-brush-render.jpg`);
  // Toothpaste: retailer packshot (495 px) upscaled slightly onto white.
  await sharp(`${web}/zym-495.jpg`).trim({ threshold: 10 }).resize({ width: 760, height: 760, fit: "inside" })
    .extend({ top: 70, bottom: 70, left: 70, right: 70, background: "#ffffff" })
    .resize({ width: 900, height: 900, fit: "contain", background: "#ffffff" }).flatten({ background: "#ffffff" }).jpeg({ quality: 92 }).toFile(`${out}/zymbion-packshot.jpg`);
})();
