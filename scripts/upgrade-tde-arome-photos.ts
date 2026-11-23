// Replaces the photos of the older Tamda Arôme products (TDE-, one small image each) with the manufacturer's packshots and
// extra photos from the Trade Concept B2B catalogue (same EANs, 1000 px), up to 4 per product.
// Data: ops/sk-tc/tde-images.json  {ean: ["pic_zbozi/....jpg", ...]} scraped from the owner's logged-in B2B session.
//   npx tsx --env-file=.env scripts/upgrade-tde-arome-photos.ts --files    download + render, no DB change
//   (commit + push the files)
//   npx tsx --env-file=.env scripts/upgrade-tde-arome-photos.ts --db       switch the products to the new photos
//   npx tsx --env-file=.env scripts/upgrade-tde-arome-photos.ts --revert   restore the previous images
import { createHash, randomBytes } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { prisma } from "../src/lib/prisma";

const MAX_EDGE = 1000;
const MAX_PHOTOS = 4;
const IMG_BASE = "https://b2b.tradeconcept.cz/";
const MAP_FILE = "ops/snapshots/tde-arome-images-map.json";
const BEFORE_FILE = "ops/snapshots/tde-arome-images-before.json";

async function render(buf: Buffer): Promise<Buffer> {
  const meta = await sharp(buf).metadata();
  const trimmed = await sharp(buf).flatten({ background: "#ffffff" }).trim({ background: "#ffffff", threshold: 14 }).toBuffer({ resolveWithObject: true });
  const ratio = (trimmed.info.width * trimmed.info.height) / ((meta.width ?? 1) * (meta.height ?? 1));
  if (ratio > 0.92) return sharp(buf).flatten({ background: "#ffffff" }).resize(MAX_EDGE, MAX_EDGE, { fit: "inside", withoutEnlargement: true }).jpeg({ quality: 76 }).toBuffer();
  const side = Math.round(Math.max(trimmed.info.width, trimmed.info.height) * 1.12);
  return sharp(trimmed.data)
    .extend({
      top: Math.floor((side - trimmed.info.height) / 2), bottom: Math.ceil((side - trimmed.info.height) / 2),
      left: Math.floor((side - trimmed.info.width) / 2), right: Math.ceil((side - trimmed.info.width) / 2), background: "#ffffff",
    })
    .resize(MAX_EDGE, MAX_EDGE, { fit: "inside", withoutEnlargement: true })
    .jpeg({ quality: 76 })
    .toBuffer();
}

async function targets() {
  const imgs: Record<string, string[]> = JSON.parse(await readFile("ops/sk-tc/tde-images.json", "utf8"));
  const ps = await prisma.product.findMany({ where: { code: { startsWith: "TDE-" }, brand: { slug: "arome" }, ean: { in: Object.keys(imgs) } }, select: { id: true, code: true, ean: true, name: true } });
  return { imgs, ps };
}

async function files() {
  const { imgs, ps } = await targets();
  await mkdir("ops/snapshots", { recursive: true });
  const map: Record<string, string[]> = {};
  for (const p of ps) {
    const dir = path.join(process.cwd(), "public", "uploads", "products", encodeURIComponent(p.code));
    await mkdir(dir, { recursive: true });
    const seen = new Set<string>();
    const urls: string[] = [];
    let idx = 0;
    for (const rel of imgs[p.ean!] ?? []) {
      if (urls.length >= MAX_PHOTOS) break;
      if (/newsletter|difuzer_all|all_cakty|icons|logo/i.test(rel)) continue;
      try {
        const res = await fetch(IMG_BASE + rel.replace(/^\//, ""), { signal: AbortSignal.timeout(60_000) });
        if (!res.ok || !(res.headers.get("content-type") ?? "").startsWith("image")) continue;
        const raw = Buffer.from(await res.arrayBuffer());
        const hash = createHash("md5").update(raw).digest("hex");
        if (seen.has(hash)) continue;
        seen.add(hash);
        if (((await sharp(raw).metadata()).width ?? 0) < 400) continue;
        const name = `${randomBytes(6).toString("hex")}-tc${idx}.jpg`;
        await writeFile(path.join(dir, name), await render(raw));
        urls.push(`/uploads/products/${encodeURIComponent(p.code)}/${name}`);
        idx++;
      } catch (err) {
        console.log(`  [error] ${p.code} ${rel}: ${(err as Error).message}`);
      }
    }
    if (urls.length) map[p.code] = urls;
    else console.log(`  [no photo] ${p.code} ${p.name}`);
  }
  await writeFile(MAP_FILE, JSON.stringify(map, null, 1));
  console.log(`${Object.keys(map).length}/${ps.length} products with new photos, ${Object.values(map).reduce((s, a) => s + a.length, 0)} files`);
}

async function db() {
  const map: Record<string, string[]> = JSON.parse(await readFile(MAP_FILE, "utf8"));
  const prods = await prisma.product.findMany({ where: { code: { in: Object.keys(map) } }, select: { id: true, code: true, images: { select: { url: true, sortOrder: true }, orderBy: { sortOrder: "asc" } } } });
  await writeFile(BEFORE_FILE, JSON.stringify(prods.map((p) => ({ code: p.code, images: p.images }))));
  for (const p of prods) {
    await prisma.productImage.deleteMany({ where: { productId: p.id } });
    await prisma.productImage.createMany({ data: map[p.code].map((url, i) => ({ productId: p.id, url, sortOrder: i })) });
  }
  console.log(`switched ${prods.length} products`);
}

async function revert() {
  const before: { code: string; images: { url: string; sortOrder: number }[] }[] = JSON.parse(await readFile(BEFORE_FILE, "utf8"));
  for (const b of before) {
    const p = await prisma.product.findUnique({ where: { code: b.code }, select: { id: true } });
    if (!p) continue;
    await prisma.productImage.deleteMany({ where: { productId: p.id } });
    await prisma.productImage.createMany({ data: b.images.map((i) => ({ productId: p.id, url: i.url, sortOrder: i.sortOrder })) });
  }
  console.log(`reverted ${before.length}`);
}

(async () => {
  const f = process.argv[2];
  if (f === "--files") await files();
  else if (f === "--db") await db();
  else if (f === "--revert") await revert();
  else console.log("use --files | --db | --revert");
  await prisma.$disconnect();
})();
