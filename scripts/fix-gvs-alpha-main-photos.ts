// Fix-up for apply-trimmed-gvs-main-photos.ts: 22 GVS main photos are PNGs with a
// transparent background (VVBETTER packshots etc.). The first trimming pass
// converted them to RGB without compositing, which turned the transparency BLACK
// for 12 of them. These copies are composited on WHITE first (and trimmed when the
// product filled < 80 % of the frame), replacing both the black ones and the
// still-transparent ones so every card has the same white tile.
//
// Usage: npx tsx scripts/fix-gvs-alpha-main-photos.ts --dry-run | (no flag = apply)
import { prisma } from "../src/lib/prisma";

const DRY_RUN = process.argv.includes("--dry-run");

const FIXED: { code: string; url: string }[] = [
  { code: "GVS-11978", url: "/uploads/products/GVS-11978/flat-0c5b3d9c9b.jpg" },
  { code: "GVS-1481113", url: "/uploads/products/GVS-1481113/flat-2b0397cd34.jpg" },
  { code: "GVS-1482493", url: "/uploads/products/GVS-1482493/flat-f8a57321e7.jpg" },
  { code: "GVS-1482509", url: "/uploads/products/GVS-1482509/flat-7e58b90dbb.jpg" },
  { code: "GVS-1488075", url: "/uploads/products/GVS-1488075/flat-18afc6e646.jpg" },
  { code: "GVS-2554846", url: "/uploads/products/GVS-2554846/flat-54609aac31.jpg" },
  { code: "GVS-2554853", url: "/uploads/products/GVS-2554853/flat-5e11c7bd90.jpg" },
  { code: "GVS-2559544", url: "/uploads/products/GVS-2559544/flat-dfe89bca62.jpg" },
  { code: "GVS-2559933", url: "/uploads/products/GVS-2559933/flat-ad842e240f.jpg" },
  { code: "GVS-3012017", url: "/uploads/products/GVS-3012017/flat-5932f910d9.jpg" },
  { code: "GVS-3013175", url: "/uploads/products/GVS-3013175/flat-755ac7efad.jpg" },
  { code: "GVS-3013182", url: "/uploads/products/GVS-3013182/flat-80a4f24a6e.jpg" },
  { code: "GVS-3255167", url: "/uploads/products/GVS-3255167/flat-03c824f614.jpg" },
  { code: "GVS-5903568", url: "/uploads/products/GVS-5903568/flat-948b8b784d.jpg" },
  { code: "GVS-5904008", url: "/uploads/products/GVS-5904008/flat-b9c384190d.jpg" },
  { code: "GVS-5904305", url: "/uploads/products/GVS-5904305/flat-ca725262cb.jpg" },
  { code: "GVS-6550430", url: "/uploads/products/GVS-6550430/flat-846cc0dc7e.jpg" },
  { code: "GVS-6555893", url: "/uploads/products/GVS-6555893/flat-9e2c7d6220.jpg" },
  { code: "GVS-7118671", url: "/uploads/products/GVS-7118671/flat-3f6565040a.jpg" },
  { code: "GVS-7119180", url: "/uploads/products/GVS-7119180/flat-323ec64bf6.jpg" },
  { code: "GVS-7119623", url: "/uploads/products/GVS-7119623/flat-9e4883c5c3.jpg" },
  { code: "GVS-9177655", url: "/uploads/products/GVS-9177655/flat-27f8e652d2.jpg" },
];

async function main() {
  let changed = 0;
  for (const t of FIXED) {
    const product = await prisma.product.findUnique({ where: { code: t.code }, include: { images: { orderBy: { sortOrder: "asc" } } } });
    const main = product?.images[0];
    if (!product || !main) {
      console.log(`  [skip] ${t.code}`);
      continue;
    }
    console.log(`  ${t.code}: ${main.url.split("/").pop()} -> ${t.url.split("/").pop()}`);
    if (DRY_RUN) continue;
    await prisma.productImage.update({ where: { id: main.id }, data: { url: t.url } });
    changed++;
  }
  console.log(`\nDone. ${changed} main photos fixed.`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
