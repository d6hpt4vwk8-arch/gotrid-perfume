// Gallery photos for the 55 Palacio/Cannabellum products created by add-palacio-catalog.ts, which only carries
// the portal's main photo. Sources, all official: the manufacturer's B2B portal (cml.palacio.cz, public image URLs,
// file numbers scanned 1..14) and the manufacturer's own e-shop palacioshop.cz (original-size images, found per EAN
// in ops/palacio-official-2026-11-05.json). Near-duplicates (same picture from both sources, or the main photo
// itself) are dropped by a difference hash; everything else is appended after the main photo — packshots,
// set contents and the in-use scenes alike (the owner asked for every official photo).
//
// Two phases so the live site never points at files that are not deployed yet:
//   npx tsx --env-file=.env scripts/add-palacio-photos.ts --files    download + write files, no DB change
//   (commit + push the files)
//   npx tsx --env-file=.env scripts/add-palacio-photos.ts --db       add the ProductImage rows
//   npx tsx --env-file=.env scripts/add-palacio-photos.ts --revert   remove the rows added by --db
import { randomBytes } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { prisma } from "../src/lib/prisma";

const MAX_EDGE = 1200;
const SCAN_MAX = 14;
const DATA_FILE = "ops/palacio-new-products.json";
const OFFICIAL_FILE = "ops/palacio-official-2026-11-05.json";
const MAP_FILE = "ops/snapshots/palacio-new-gallery-map.json";
const ADDED_FILE = "ops/snapshots/palacio-new-gallery-added.json";
const NEAR_DUPLICATE_BITS = 13;

interface Item {
  id: string;
  pid: number;
  file: number;
}
interface Official {
  url: string | null;
  own?: string[];
}

const codeOf = (id: string) => `PAL-${id.replace(/^PAL/, "")}`;

async function download(url: string): Promise<Buffer | null> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(60_000) });
    if (!res.ok || !(res.headers.get("content-type") ?? "").startsWith("image")) return null;
    return Buffer.from(await res.arrayBuffer());
  } catch {
    return null;
  }
}

// Difference hashes (9x8 greyscale, one bit per left>right neighbour) in three framings, so the same picture still
// matches when one source serves it portrait and the other square (stretched, centre-cropped or padded on white).
async function dhash(buf: Buffer): Promise<bigint[]> {
  const fits = [
    sharp(buf).flatten({ background: "#ffffff" }).resize(9, 8, { fit: "fill" }),
    sharp(buf).flatten({ background: "#ffffff" }).resize(9, 8, { fit: "cover" }),
    sharp(buf).flatten({ background: "#ffffff" }).resize(9, 8, { fit: "contain", background: "#ffffff" }),
  ];
  const out: bigint[] = [];
  for (const f of fits) {
    const px = await f.greyscale().raw().toBuffer();
    let h = 0n;
    for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) h = (h << 1n) | (px[y * 9 + x] > px[y * 9 + x + 1] ? 1n : 0n);
    out.push(h);
  }
  return out;
}

function bits(a: bigint, b: bigint): number {
  let x = a ^ b;
  let n = 0;
  while (x) {
    n += Number(x & 1n);
    x >>= 1n;
  }
  return n;
}

const distance = (a: bigint[], b: bigint[]) => Math.min(...a.flatMap((x) => b.map((y) => bits(x, y))));

async function files() {
  const items: Item[] = JSON.parse(await readFile(DATA_FILE, "utf8"));
  const official: Record<string, Official> = JSON.parse(await readFile(OFFICIAL_FILE, "utf8"));
  await mkdir("ops/snapshots", { recursive: true });
  const map: Record<string, string[]> = {};

  for (const it of items) {
    const code = codeOf(it.id);
    const kept: bigint[][] = [];
    const out: string[] = [];
    const dir = path.join(process.cwd(), "public", "uploads", "products", encodeURIComponent(code));

    // the main photo already on the product comes from this portal file: never repeat it
    const main = await download(`https://cml.palacio.cz/product/${it.pid}/file/${it.file}/w1200`);
    if (main) kept.push(await dhash(main));

    const sources: string[] = [];
    let misses = 0;
    for (let n = 1; n <= SCAN_MAX && misses < 4; n++) {
      if (n === it.file) continue;
      const url = `https://cml.palacio.cz/product/${it.pid}/file/${n}/w1200`;
      sources.push(url);
      // probe lazily below; stop scanning after four consecutive missing numbers
      const head = await fetch(url, { method: "HEAD", signal: AbortSignal.timeout(30_000) }).catch(() => null);
      if (!head || !head.ok) {
        misses++;
        sources.pop();
      } else misses = 0;
    }
    for (const name of official[it.id]?.own ?? []) sources.push(`https://cdn.myshoptet.com/usr/www.palacioshop.cz/user/shop/orig/${name}`);

    for (const url of sources) {
      const buf = await download(url);
      if (!buf) continue;
      const h = await dhash(buf);
      if (kept.some((k) => distance(k, h) <= NEAR_DUPLICATE_BITS)) continue;
      kept.push(h);
      const jpg = await sharp(buf)
        .flatten({ background: "#ffffff" })
        .resize(MAX_EDGE, MAX_EDGE, { fit: "inside", withoutEnlargement: true })
        .jpeg({ quality: 80 })
        .toBuffer();
      await mkdir(dir, { recursive: true });
      const name = `${randomBytes(6).toString("hex")}-g${out.length + 1}.jpg`;
      await writeFile(path.join(dir, name), jpg);
      out.push(`/uploads/products/${encodeURIComponent(code)}/${name}`);
    }
    map[code] = out;
    console.log(`${code}: +${out.length}`);
  }
  await writeFile(MAP_FILE, JSON.stringify(map, null, 1));
  console.log(`total extra photos: ${Object.values(map).reduce((s, v) => s + v.length, 0)}`);
}

async function db() {
  const map: Record<string, string[]> = JSON.parse(await readFile(MAP_FILE, "utf8"));
  const added: string[] = [];
  for (const [code, urls] of Object.entries(map)) {
    const p = await prisma.product.findUnique({ where: { code }, select: { id: true, images: { select: { id: true } } } });
    if (!p || p.images.length !== 1) continue;
    for (let i = 0; i < urls.length; i++) {
      const row = await prisma.productImage.create({ data: { productId: p.id, url: urls[i], sortOrder: i + 1 } });
      added.push(row.id);
    }
  }
  await writeFile(ADDED_FILE, JSON.stringify(added));
  console.log(`added ${added.length} gallery rows`);
}

async function revert() {
  const ids: string[] = JSON.parse(await readFile(ADDED_FILE, "utf8"));
  const res = await prisma.productImage.deleteMany({ where: { id: { in: ids } } });
  console.log(`removed ${res.count}`);
}

const mode = process.argv.includes("--files") ? files : process.argv.includes("--db") ? db : process.argv.includes("--revert") ? revert : null;
if (!mode) {
  console.error("Usage: --files | --db | --revert");
  process.exit(1);
}
mode()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
