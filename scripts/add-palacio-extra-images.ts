// Second Palacio photo pass (see upgrade-palacio-images.ts): owner asked for ALL the manufacturer's photos on the
// product pages, not only the white-background packshots. These are the remaining portal images — lifestyle /
// in-use / mood shots — appended after the packshots already in the gallery (sortOrder continues from the
// highest existing one). Same encoding as the first pass (JPEG q88, <= 1400 px, flattened on white).
//
//   npx tsx scripts/add-palacio-extra-images.ts --files   download + write files, no DB change
//   (commit + push the files)
//   npx tsx scripts/add-palacio-extra-images.ts --db      append ProductImage rows
//   npx tsx scripts/add-palacio-extra-images.ts --revert  delete the rows this script appended
import { randomBytes } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { prisma } from "../src/lib/prisma";

const MAX_EDGE = 1400;
const OUT_DIR = path.join(process.cwd(), "ops", "snapshots");
const MAP_FILE = path.join(OUT_DIR, "palacio-extra-images-map.json");

// [our product code, portal product id, portal file numbers]
const PLAN: [string, number, number[]][] = [
  ["TDE-344251", 287, [6, 7]],
  ["TDE-403842", 396, [4]],
  ["TDE-351692", 277, [7, 8]],
  ["TDE-344739", 299, [4, 5]],
  ["TDE-671125", 741, [4]],
  ["TDE-671123", 742, [4]],
  ["TDE-671124", 740, [4]],
  ["TDE-347885", 304, [5, 6]],
  ["TDE-381141", 393, [4]],
  ["TDE-376202", 259, [4]],
  ["TDE-404595", 426, [7, 8]],
  ["TDE-423854", 724, [5, 6]],
  ["TDE-347892", 325, [2, 4]],
  ["TDE-344255", 256, [2]],
  ["TDE-403843", 395, [7]],
  ["TDE-381139", 364, [4, 5]],
  ["TDE-376205", 376, [4]],
  ["TDE-402767", 633, [4, 7]],
  ["TDE-396411", 472, [4]],
  ["TDE-403110", 651, [6, 7]],
  ["TDE-376203", 374, [2, 4]],
  ["TDE-347883", 269, [7, 8]],
  ["TDE-632037", 498, [4, 5]],
  ["TDE-396412", 473, [5]],
];

const url = (pid: number, n: number) => `https://cml.palacio.cz/product/${pid}/file/${n}/w1200`;

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
      const out = await sharp(Buffer.from(await res.arrayBuffer()))
        .flatten({ background: "#ffffff" })
        .resize(MAX_EDGE, MAX_EDGE, { fit: "inside", withoutEnlargement: true })
        .jpeg({ quality: 88 })
        .toBuffer();
      const name = `${randomBytes(6).toString("hex")}-x${i}.jpg`;
      await writeFile(path.join(dir, name), out);
      map[code].push(`/uploads/products/${encodeURIComponent(code)}/${name}`);
    }
    console.log(`  ${code}: ${map[code].length} files`);
  }
  await writeFile(MAP_FILE, JSON.stringify(map, null, 1));
}

async function db() {
  const map: Record<string, string[]> = JSON.parse(await readFile(MAP_FILE, "utf8"));
  let added = 0;
  for (const [code, urls] of Object.entries(map)) {
    const p = await prisma.product.findUnique({ where: { code }, include: { images: { orderBy: { sortOrder: "desc" }, take: 1 } } });
    if (!p) continue;
    let order = (p.images[0]?.sortOrder ?? -1) + 1;
    for (const u of urls) {
      const exists = await prisma.productImage.findFirst({ where: { productId: p.id, url: u } });
      if (exists) continue;
      await prisma.productImage.create({ data: { productId: p.id, url: u, sortOrder: order++ } });
      added++;
    }
  }
  console.log(`Done. ${added} gallery photos added.`);
}

async function revert() {
  const map: Record<string, string[]> = JSON.parse(await readFile(MAP_FILE, "utf8"));
  const urls = Object.values(map).flat();
  const res = await prisma.productImage.deleteMany({ where: { url: { in: urls } } });
  console.log(`Reverted: ${res.count} rows removed.`);
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
