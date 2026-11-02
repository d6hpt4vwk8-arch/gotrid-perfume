import sharp from "sharp";
const [src, dest] = process.argv.slice(2);
(async () => {
  const t = await sharp(src).trim({ threshold: 20 }).toBuffer();
  await sharp(t).resize({ width: 860, height: 860, fit: "inside" }).extend({ top: 20, bottom: 20, left: 20, right: 20, background: "#ffffff" })
    .resize({ width: 900, height: 900, fit: "contain", background: "#ffffff" }).flatten({ background: "#ffffff" }).jpeg({ quality: 92 }).toFile(dest);
})();
