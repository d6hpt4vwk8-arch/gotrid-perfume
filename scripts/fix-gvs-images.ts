// One-off patch: 4 GVS Cosmetics products (imported in scripts/import-gvs-cosmetics.ts)
// got the wrong photo — the source XLSX had a small "Vegan" certification
// badge anchored in the same cell as several product photos (at a larger
// colOff, i.e. positioned in a corner over the real photo), and the
// original extraction picked whichever anchor came last in the drawing
// XML instead of the one actually representing the product. Re-extracted
// with "smallest colOff wins" and copied the 4 correct images here.
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { prisma } from "../src/lib/prisma";

const FIX_DIR = path.join(process.cwd(), "scripts", "gvs-fix-media");

const FIXES: { ean: string; sourceFile: string }[] = [
  { ean: "8809447256276", sourceFile: "image132.png" }, // Dear.A Cool Fit Primer
  { ean: "8809875903568", sourceFile: "image42.png" }, // Vvbetter Daily Airfit Sunscreen Spf 50+
  { ean: "8809971488075", sourceFile: "image38.png" }, // Vvbetter Jeju Yuja Balancing Bubble Cleanser, 145 ml
  { ean: "8809647119180", sourceFile: "image2.png" }, // Vvbetter Jeju Yuja Cera Balancing Cream, 50 ml
];

async function main() {
  for (const fix of FIXES) {
    const product = await prisma.product.findFirst({ where: { ean: fix.ean }, include: { images: true } });
    if (!product) {
      console.warn(`  [warn] no product for EAN ${fix.ean}`);
      continue;
    }

    const ext = path.extname(fix.sourceFile).replace(".", "") || "jpg";
    const dir = path.join(process.cwd(), "public", "uploads", "products", encodeURIComponent(product.code));
    await mkdir(dir, { recursive: true });
    const hash = createHash("sha1").update(fix.sourceFile + product.code + "fix").digest("hex").slice(0, 12);
    const filename = `${hash}-0.${ext}`;
    const buf = await readFile(path.join(FIX_DIR, fix.sourceFile));
    await writeFile(path.join(dir, filename), buf);
    const url = `/uploads/products/${encodeURIComponent(product.code)}/${filename}`;

    if (product.images[0]) {
      await prisma.productImage.update({ where: { id: product.images[0].id }, data: { url } });
    } else {
      await prisma.productImage.create({ data: { productId: product.id, url, sortOrder: 0 } });
    }
    console.log(`Fixed ${product.name} (${product.code}) -> ${url}`);
  }
}
main().catch(console.error).finally(() => prisma.$disconnect());
