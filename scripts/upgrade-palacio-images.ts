// Palacio product photos from the manufacturer's own B2B portal (cml.palacio.cz, owner's account; the image
// URLs are public). Our photos were 500x500; the portal serves up to 2000+ px packshots. Per product we take
// only clean pack shots on a white background (checked by eye on contact sheets): the portal's AI-style
// lifestyle scenes with people / backdrops were left out. The first entry of each list is the portal's main
// photo; it replaces the current main image (trimmed to the pack and centred on a white square), the rest are
// appended as gallery photos. Re-encoded as JPEG q88 at <= 1400 px.
//
// Two phases so the live site never points at files that are not deployed yet:
//   npx tsx scripts/upgrade-palacio-images.ts --files    download + write files, no DB change
//   (commit + push the files)
//   npx tsx scripts/upgrade-palacio-images.ts --db       point ProductImage rows at the new files
//   npx tsx scripts/upgrade-palacio-images.ts --revert   restore the rows saved before --db
import { randomBytes } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { prisma } from "../src/lib/prisma";

const MAX_EDGE = 1400;
const OUT_DIR = path.join(process.cwd(), "ops", "snapshots");
const MAP_FILE = path.join(OUT_DIR, "palacio-images-map.json");
const BEFORE_FILE = path.join(OUT_DIR, "palacio-images-before.json");

// [our product code, portal product id, portal file numbers (main first)]
const PLAN: [string, number, number[]][] = [
  ["TDE-344251", 287, [5, 4]],
  ["TDE-343523", 280, [3, 4, 6]],
  ["TDE-403842", 396, [3]],
  ["TDE-351692", 277, [4, 5, 6]],
  ["TDE-344739", 299, [1, 2, 3]],
  ["TDE-671125", 741, [1, 2, 3, 5]],
  ["TDE-671123", 742, [1, 2, 3, 5]],
  ["TDE-344257", 291, [6, 7, 8]],
  ["TDE-671124", 740, [1, 2, 3, 5]],
  ["TDE-347890", 329, [3, 4]],
  ["TDE-347885", 304, [3, 4]],
  ["TDE-381141", 393, [3]],
  ["TDE-376202", 259, [1, 2, 3]],
  ["TDE-404595", 426, [5, 4, 6]],
  ["TDE-404594", 420, [2]],
  ["TDE-346519", 317, [1, 2, 3]],
  ["TDE-380983", 389, [1, 2, 3]],
  ["TDE-347888", 328, [3, 4]],
  ["TDE-402081", 650, [8, 4, 6]],
  ["TDE-457567", 726, [4, 5, 6, 7]],
  ["TDE-343515", 270, [5, 6]],
  ["TDE-423854", 724, [3, 4]],
  ["TDE-347892", 325, [1, 3]],
  ["TDE-344255", 256, [1, 3]],
  ["TDE-347896", 321, [1, 2, 3]],
  ["TDE-403843", 395, [8]],
  ["TDE-381139", 364, [3]],
  ["TDE-347894", 312, [1, 2, 3]],
  ["TDE-342008", 274, [3, 4, 5]],
  ["TDE-376201", 362, [2]],
  ["TDE-376205", 376, [1, 2, 3]],
  ["TDE-402767", 633, [6]],
  ["TDE-342012", 257, [7, 3, 5, 6]],
  ["TDE-351700", 327, [4]],
  ["TDE-345148", 260, [2, 3]],
  ["TDE-396411", 472, [1, 2, 3]],
  ["TDE-403110", 651, [4, 8]],
  ["TDE-376203", 374, [1, 3]],
  ["TDE-347883", 269, [4, 5, 6]],
  ["TDE-632037", 498, [3]],
  ["TDE-396412", 473, [1, 2, 3]],
  ["TDE-350200", 331, [3]],
  ["TDE-345147", 305, [5, 6]],
  ["TDE-418008", 693, [3]],
];

const url = (pid: number, n: number) => `https://cml.palacio.cz/product/${pid}/file/${n}/w1200`;

async function render(buf: Buffer, main: boolean): Promise<Buffer> {
  let img = sharp(buf).flatten({ background: "#ffffff" });
  if (main) {
    // fill the card with the pack: trim the white margin, then re-centre on a square with ~5 % air
    const trimmed = await img.trim({ background: "#ffffff", threshold: 12 }).toBuffer({ resolveWithObject: true });
    const side = Math.round(Math.max(trimmed.info.width, trimmed.info.height) * 1.1);
    img = sharp(trimmed.data).extend({
      top: Math.floor((side - trimmed.info.height) / 2),
      bottom: Math.ceil((side - trimmed.info.height) / 2),
      left: Math.floor((side - trimmed.info.width) / 2),
      right: Math.ceil((side - trimmed.info.width) / 2),
      background: "#ffffff",
    });
  }
  return img.resize(MAX_EDGE, MAX_EDGE, { fit: "inside", withoutEnlargement: true }).jpeg({ quality: 88 }).toBuffer();
}

async function files() {
  await mkdir(OUT_DIR, { recursive: true });
  const map: Record<string, string[]> = {};
  for (const [code, pid, ns] of PLAN) {
    const dir = path.join(process.cwd(), "public", "uploads", "products", encodeURIComponent(code));
    await mkdir(dir, { recursive: true });
    map[code] = [];
    for (let i = 0; i < ns.length; i++) {
      const res = await fetch(url(pid, ns[i]), { signal: AbortSignal.timeout(60_000) });
      if (!res.ok || !(res.headers.get("content-type") ?? "").startsWith("image")) {
        console.log(`  [error] ${code} file ${ns[i]}: HTTP ${res.status}`);
        continue;
      }
      const out = await render(Buffer.from(await res.arrayBuffer()), i === 0);
      const name = `${randomBytes(6).toString("hex")}-p${i}.jpg`;
      await writeFile(path.join(dir, name), out);
      map[code].push(`/uploads/products/${encodeURIComponent(code)}/${name}`);
    }
    console.log(`  ${code}: ${map[code].length} files`);
  }
  await writeFile(MAP_FILE, JSON.stringify(map, null, 1));
}

async function db() {
  const map: Record<string, string[]> = JSON.parse(await readFile(MAP_FILE, "utf8"));
  const before: Record<string, { id: string; url: string; sortOrder: number }[]> = {};
  for (const code of Object.keys(map)) {
    const p = await prisma.product.findUnique({ where: { code }, include: { images: { orderBy: { sortOrder: "asc" } } } });
    if (!p) continue;
    before[code] = p.images.map((i) => ({ id: i.id, url: i.url, sortOrder: i.sortOrder }));
  }
  await writeFile(BEFORE_FILE, JSON.stringify(before, null, 1));
  let mains = 0;
  let extras = 0;
  for (const [code, urls] of Object.entries(map)) {
    const p = await prisma.product.findUnique({ where: { code }, include: { images: { orderBy: { sortOrder: "asc" } } } });
    if (!p || urls.length === 0) continue;
    if (p.images[0]) await prisma.productImage.update({ where: { id: p.images[0].id }, data: { url: urls[0] } });
    else await prisma.productImage.create({ data: { productId: p.id, url: urls[0], sortOrder: 0 } });
    mains++;
    if (p.images.length <= 1) {
      for (let i = 1; i < urls.length; i++) {
        await prisma.productImage.create({ data: { productId: p.id, url: urls[i], sortOrder: i } });
        extras++;
      }
    }
  }
  console.log(`Done. ${mains} main photos replaced, ${extras} gallery photos added.`);
}

async function revert() {
  const before: Record<string, { id: string; url: string; sortOrder: number }[]> = JSON.parse(await readFile(BEFORE_FILE, "utf8"));
  for (const [code, rows] of Object.entries(before)) {
    const p = await prisma.product.findUnique({ where: { code }, select: { id: true } });
    if (!p) continue;
    await prisma.productImage.deleteMany({ where: { productId: p.id, id: { notIn: rows.map((r) => r.id) } } });
    for (const r of rows) await prisma.productImage.update({ where: { id: r.id }, data: { url: r.url, sortOrder: r.sortOrder } });
  }
  console.log("Reverted.");
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
