// Vegan / cruelty-free flags for GVS Cosmetics products + main photos WITHOUT the
// baked-in "Vegan" certification logo (owner 2026-10-09: the card now shows its own
// Vegan pill, a second one inside the photo would look odd).
//
// Flags are set only where a source says it about the PRODUCT: VVBETTER's own pack
// shots carry the Korean Vegan certification mark (11 products); Dr. Althea /
// Free Moment / VVBETTER texts call these products vegan ("Vegan Certified",
// "vegan formula", "vegan mist/serum/cream", ...). Products where only an
// INGREDIENT is vegan ("vegan PDRN", "vegan collagen water") are NOT flagged.
// Cruelty-free: only where the text says so ("cruelty-free").
//
// Usage: npx tsx scripts/set-gvs-badges.ts --dry-run | (no flag = apply)
import { prisma } from "../src/lib/prisma";

const DRY_RUN = process.argv.includes("--dry-run");

const VEGAN = ["GVS-1488075", "GVS-254395", "GVS-254494", "GVS-254944", "GVS-254951", "GVS-255750", "GVS-256184", "GVS-256191", "GVS-256412", "GVS-256658", "GVS-3013175", "GVS-3013182", "GVS-3255167", "GVS-5903568", "GVS-5904008", "GVS-5904305", "GVS-6555893", "GVS-7118671", "GVS-7119180", "GVS-7119623", "GVS-7251943"];
const CRUELTY_FREE = ["GVS-3255167", "GVS-5903568", "GVS-5904008", "GVS-5904305", "GVS-7118671", "GVS-7119623"];
// Main photo (sortOrder 0) without the logo; transparent PNG flattened on white.
const NO_LOGO_MAIN: { code: string; url: string }[] = [
  { code: "GVS-1488075", url: "/uploads/products/GVS-1488075/nologo-89397a3f29.jpg" },
  { code: "GVS-3013175", url: "/uploads/products/GVS-3013175/nologo-e9d25298cd.jpg" },
  { code: "GVS-3013182", url: "/uploads/products/GVS-3013182/nologo-a10a1a2f6d.jpg" },
  { code: "GVS-3255167", url: "/uploads/products/GVS-3255167/nologo-29e7e9274f.jpg" },
  { code: "GVS-5903568", url: "/uploads/products/GVS-5903568/nologo-52f5c0956d.jpg" },
  { code: "GVS-5904008", url: "/uploads/products/GVS-5904008/nologo-b284fc49c8.jpg" },
  { code: "GVS-5904305", url: "/uploads/products/GVS-5904305/nologo-64ef07464a.jpg" },
  { code: "GVS-6555893", url: "/uploads/products/GVS-6555893/nologo-2a4298195d.jpg" },
  { code: "GVS-7118671", url: "/uploads/products/GVS-7118671/nologo-b36c06381a.jpg" },
  { code: "GVS-7119180", url: "/uploads/products/GVS-7119180/nologo-0b66c63409.jpg" },
  { code: "GVS-7119623", url: "/uploads/products/GVS-7119623/nologo-a4f2282186.jpg" },
];

async function main() {
  for (const code of VEGAN) {
    const r = DRY_RUN ? { count: 1 } : await prisma.product.updateMany({ where: { code }, data: { isVegan: true } });
    if (r.count === 0) console.log(`  [skip] vegan: not found ${code}`);
  }
  for (const code of CRUELTY_FREE) {
    const r = DRY_RUN ? { count: 1 } : await prisma.product.updateMany({ where: { code }, data: { isCrueltyFree: true } });
    if (r.count === 0) console.log(`  [skip] cruelty-free: not found ${code}`);
  }
  let swapped = 0;
  for (const t of NO_LOGO_MAIN) {
    const product = await prisma.product.findUnique({ where: { code: t.code }, include: { images: { orderBy: { sortOrder: "asc" } } } });
    const main = product?.images[0];
    if (!product || !main) continue;
    console.log(`  ${t.code}: main -> ${t.url.split("/").pop()}`);
    if (DRY_RUN) continue;
    await prisma.productImage.update({ where: { id: main.id }, data: { url: t.url } });
    swapped++;
  }
  console.log(`\nDone. ${VEGAN.length} vegan, ${CRUELTY_FREE.length} cruelty-free flagged, ${swapped} main photos swapped.`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
