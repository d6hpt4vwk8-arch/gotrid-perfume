// Replaces the weak main photos (500 / 350 px) of two SP Venture Dr.Althea listings with the brand's official
// 1000+ px packshots (prepared in /tmp/gvsx/out by the 2026-10-23 K-beauty work). Run right before pushing: the
// files under public/uploads must be committed together with this DB change.
//   npx tsx --env-file=.env scripts/swap-spv-main-photos-2026-10-23.ts [--apply]
import { createHash } from "node:crypto";
import { copyFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { prisma } from "../src/lib/prisma";

const APPLY = process.argv.includes("--apply");
const SWAPS = [
  { code: "SPV-0247761", from: "/tmp/gvsx/out/GVS-254708/main.jpg" }, // Green Relief Amino Gel Cleanser (was 500 px)
  { code: "SPV-0247765", from: "/tmp/gvsx/out/GVS-254609/main.jpg" }, // 15% Niacinamide Purity Serum (was 350 px)
];

async function main() {
  for (const s of SWAPS) {
    const p = await prisma.product.findUnique({ where: { code: s.code }, select: { id: true, images: { orderBy: { sortOrder: "asc" }, select: { id: true, url: true } } } });
    if (!p || !p.images[0]) { console.log(`skip ${s.code}`); continue; }
    const filename = `trim-${createHash("sha1").update(s.code + "main2610").digest("hex").slice(0, 10)}.jpg`;
    const url = `/uploads/products/${s.code}/${filename}`;
    console.log(`${s.code}: ${p.images[0].url} -> ${url}`);
    if (!APPLY) continue;
    await mkdir(path.join("public", "uploads", "products", s.code), { recursive: true });
    await copyFile(s.from, path.join("public", "uploads", "products", s.code, filename));
    await prisma.productImage.update({ where: { id: p.images[0].id }, data: { url } });
  }
}
main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
