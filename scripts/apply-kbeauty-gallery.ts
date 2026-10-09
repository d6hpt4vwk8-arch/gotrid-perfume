// Adds gallery photos picked by eye (ops/gallery-cache/k-picks.txt, from the contact sheets) to the SPV K-beauty
// products. Candidates come from the brands' official Shopify stores / kosmosbeauty.com (see ops/gallery-cache).
// Rules used when picking: lifestyle / texture / in-hand / model / different-angle shots only; no infographics with
// English copy, no before/after charts, no plain pack shots that duplicate the main photo, no other pack size.
// Files are written to public/uploads/products/<code>/ — PUSH THE FILES RIGHT AFTER APPLYING (the DB is shared with prod).
//   npx tsx scripts/apply-kbeauty-gallery.ts            dry run
//   npx tsx scripts/apply-kbeauty-gallery.ts --apply
//   npx tsx scripts/apply-kbeauty-gallery.ts --revert=ops/snapshots/kbeauty-gallery-*.json
import { randomBytes } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import sharp from "sharp";
import { prisma } from "../src/lib/prisma";

const APPLY = process.argv.includes("--apply");
const REVERT = process.argv.find((a) => a.startsWith("--revert="))?.split("=")[1];

async function main() {
  if (REVERT) {
    const ids: string[] = JSON.parse(readFileSync(REVERT, "utf8"));
    const r = await prisma.productImage.deleteMany({ where: { id: { in: ids } } });
    console.log("removed", r.count);
    return;
  }
  const cands: any[] = JSON.parse(readFileSync("ops/gallery-cache/k-candidates.json", "utf8"));
  const byCode = new Map(cands.map((c) => [c.code.replace(/^SPV-/, ""), c]));
  const picks = readFileSync("ops/gallery-cache/k-picks.txt", "utf8").split("\n").filter(Boolean).map((l) => l.split(":"));
  const created: string[] = [];
  let photos = 0, products = 0;
  for (const [short, idxs] of picks) {
    const entry = byCode.get(short);
    if (!entry) { console.log("no candidates for", short); continue; }
    const product = await prisma.product.findUnique({ where: { code: entry.code }, include: { images: { orderBy: { sortOrder: "asc" } } } });
    if (!product) { console.log("not found", entry.code); continue; }
    if (product.images.length > 1) { console.log("skip (has gallery)", entry.code); continue; }
    const files = idxs.split(",").map((n) => entry.cands[Number(n) - 1]?.file).filter(Boolean) as string[];
    console.log(entry.code, entry.name, "+" + files.length);
    if (!APPLY) { photos += files.length; products++; continue; }
    const dir = path.join(process.cwd(), "public", "uploads", "products", encodeURIComponent(product.code));
    mkdirSync(dir, { recursive: true });
    let order = product.images.length;
    for (const f of files) {
      const name = `${randomBytes(6).toString("hex")}-${order}.jpg`;
      await sharp(readFileSync(f)).flatten({ background: "#ffffff" }).resize(1400, 1400, { fit: "inside", withoutEnlargement: true }).jpeg({ quality: 88 }).toFile(path.join(dir, name));
      const row = await prisma.productImage.create({ data: { productId: product.id, url: `/uploads/products/${encodeURIComponent(product.code)}/${name}`, sortOrder: order } });
      created.push(row.id); order++; photos++;
    }
    products++;
  }
  console.log(`\n${APPLY ? "APPLIED" : "DRY RUN"}: ${photos} photos for ${products} products`);
  if (APPLY && created.length) {
    mkdirSync("ops/snapshots", { recursive: true });
    const f = `ops/snapshots/kbeauty-gallery-${new Date().toISOString().replace(/[:.]/g, "-")}.json`;
    writeFileSync(f, JSON.stringify(created)); console.log("snapshot", f);
  }
}
main().catch((e) => { console.error(e); process.exitCode = 1; }).finally(() => prisma.$disconnect());
