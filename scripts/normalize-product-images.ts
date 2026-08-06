import { readdir, writeFile } from "fs/promises";
import path from "path";
import sharp from "sharp";

/**
 * Supplier product photos vary wildly in how much white margin surrounds
 * the product (some fill the frame edge-to-edge, others sit tiny in the
 * middle of a mostly-empty square) — that's what made the storefront grid
 * look inconsistent even though every card renders the same fixed-size
 * square. This trims each photo down to its actual content, then recomposes
 * it onto a fresh square canvas with a fixed padding ratio, so every product
 * ends up at roughly the same visual scale regardless of what the original
 * photo looked like.
 */

const ROOT = path.join(process.cwd(), "public/uploads/products");
const CANVAS_SIZE = 1200;
const PADDING_RATIO = 0.06;
const CONCURRENCY = 8;

async function walk(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await walk(full)));
    } else if (/\.(jpe?g|png|webp)$/i.test(entry.name)) {
      files.push(full);
    }
  }
  return files;
}

async function normalize(file: string): Promise<void> {
  const ext = path.extname(file).toLowerCase();
  const pad = Math.round(CANVAS_SIZE * PADDING_RATIO);
  const target = CANVAS_SIZE - pad * 2;

  const flattened = await sharp(file).flatten({ background: "#ffffff" }).toBuffer();

  let trimmed: Buffer;
  try {
    trimmed = await sharp(flattened).trim({ threshold: 12 }).toBuffer();
  } catch {
    // Nothing trimmable (no uniform border) — fall back to the flattened original.
    trimmed = flattened;
  }

  const resized = sharp(trimmed)
    .resize(target, target, { fit: "contain", background: "#ffffff" })
    .extend({ top: pad, bottom: pad, left: pad, right: pad, background: "#ffffff" });

  const finalBuffer = await (ext === ".png"
    ? resized.png({ quality: 90 })
    : resized.jpeg({ quality: 90 })
  ).toBuffer();

  await writeFile(file, finalBuffer);
}

async function run() {
  const files = await walk(ROOT);
  console.log(`Found ${files.length} product images.`);

  let done = 0;
  let failed = 0;
  const errors: { file: string; error: string }[] = [];

  for (let i = 0; i < files.length; i += CONCURRENCY) {
    const batch = files.slice(i, i + CONCURRENCY);
    await Promise.all(
      batch.map(async (file) => {
        try {
          await normalize(file);
        } catch (err) {
          failed++;
          errors.push({ file, error: err instanceof Error ? err.message : String(err) });
        }
        done++;
      }),
    );
    if (done % 80 < CONCURRENCY) {
      console.log(`${done}/${files.length} processed (${failed} failed)`);
    }
  }

  console.log(`Done. ${done - failed}/${files.length} normalized, ${failed} failed.`);
  if (errors.length > 0) {
    console.log("Failures:");
    for (const e of errors) console.log(`  ${e.file}: ${e.error}`);
  }
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
