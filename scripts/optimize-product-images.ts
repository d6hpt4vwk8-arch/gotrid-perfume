// One-off (and periodically re-runnable, e.g. after a fresh supplier import)
// batch shrink for public/uploads/products — next.config.ts runs images with
// unoptimized:true (Vercel's per-image optimizer blew through its quota on
// this catalog's ~16k photos the day it was imported), which means every
// visitor downloads the stored file at full size no matter how small it's
// actually displayed. A sample of the catalog showed 71% of files wider
// than 800px on their longest side (median 1200px, some over 2000px) — this
// resizes anything past MAX_DIMENSION down (product photos never need to be
// larger than that for any current on-site display size) and re-compresses
// in place, so the fix lives in the files themselves rather than requiring
// the paid optimizer. Idempotent: already-small files are left untouched.
import { readdir, stat, writeFile } from "fs/promises";
import path from "path";
import sharp from "sharp";

const ROOT = path.join(process.cwd(), "public/uploads/products");
const MAX_DIMENSION = 1000;
// Below this, a file isn't worth re-encoding even if it's already within
// MAX_DIMENSION — re-compressing something already small risks a visible
// quality hit for negligible size savings.
const SKIP_UNDER_BYTES = 150 * 1024;
const JPEG_QUALITY = 82;
const WEBP_QUALITY = 82;

const IMAGE_EXTENSIONS = new Set([".jpg", ".jpeg", ".png", ".webp"]);

async function* walk(dir: string): AsyncGenerator<string> {
  const entries = await readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) yield* walk(full);
    else yield full;
  }
}

async function optimizeOne(file: string): Promise<{ before: number; after: number; touched: boolean }> {
  const before = (await stat(file)).size;
  const ext = path.extname(file).toLowerCase();

  const metadata = await sharp(file).metadata();
  const longest = Math.max(metadata.width ?? 0, metadata.height ?? 0);

  if (longest <= MAX_DIMENSION && before < SKIP_UNDER_BYTES) {
    return { before, after: before, touched: false };
  }

  // .rotate() with no args bakes in the EXIF orientation before we drop
  // metadata on output — otherwise a browser that also honors EXIF would
  // double-rotate an image whose orientation tag survived re-encoding.
  let pipeline = sharp(file).rotate();
  if (longest > MAX_DIMENSION) {
    pipeline = pipeline.resize({
      width: MAX_DIMENSION,
      height: MAX_DIMENSION,
      fit: "inside",
      withoutEnlargement: true,
    });
  }

  let buffer: Buffer;
  if (ext === ".png") {
    // Lossless re-compression only (no quality/quantization) — safest
    // choice for a batch job with no human review of each output.
    buffer = await pipeline.png({ compressionLevel: 9, effort: 10 }).toBuffer();
  } else if (ext === ".webp") {
    buffer = await pipeline.webp({ quality: WEBP_QUALITY }).toBuffer();
  } else {
    buffer = await pipeline.jpeg({ quality: JPEG_QUALITY, mozjpeg: true }).toBuffer();
  }

  if (buffer.length >= before) {
    // Re-encoding made it bigger (rare — an already well-compressed small-
    // dimension file) — keep the original bytes.
    return { before, after: before, touched: false };
  }

  await writeFile(file, buffer);
  return { before, after: buffer.length, touched: true };
}

async function main() {
  let processed = 0;
  let touched = 0;
  let errors = 0;
  let beforeBytes = 0;
  let afterBytes = 0;
  const startedAt = Date.now();

  for await (const file of walk(ROOT)) {
    if (!IMAGE_EXTENSIONS.has(path.extname(file).toLowerCase())) continue;
    processed++;
    try {
      const result = await optimizeOne(file);
      beforeBytes += result.before;
      afterBytes += result.after;
      if (result.touched) touched++;
    } catch (err) {
      errors++;
      console.error(`ERROR ${file}:`, err instanceof Error ? err.message : err);
    }

    if (processed % 1000 === 0) {
      const elapsed = ((Date.now() - startedAt) / 1000).toFixed(0);
      console.log(`...${processed} processed, ${touched} resized, ${errors} errors (${elapsed}s)`);
    }
  }

  const elapsed = ((Date.now() - startedAt) / 1000).toFixed(0);
  console.log(`\nDone in ${elapsed}s.`);
  console.log(`Processed: ${processed}, resized: ${touched}, errors: ${errors}`);
  console.log(
    `Total size: ${(beforeBytes / 1024 / 1024).toFixed(1)} MB -> ${(afterBytes / 1024 / 1024).toFixed(1)} MB` +
      ` (-${(((beforeBytes - afterBytes) / beforeBytes) * 100).toFixed(1)}%)`,
  );
}

main();
