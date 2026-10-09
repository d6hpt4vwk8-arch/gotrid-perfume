// Swaps the MAIN photo (sortOrder 0) of 66 GVS products for a copy with the empty
// white margins trimmed off (owner 2026-10-09: competitors' product photos look
// bigger — ours had the product floating in ~45-70 % of the frame). The trim is
// cut to the product's bounding box + 6 % margin on the photo's own flat
// background colour; no resampling, so the product keeps its original pixels.
// Files were produced by a one-off PIL script (corner-colour mask, threshold 14)
// and sit next to the originals, which are left on disk. Products whose photo
// has a non-uniform background (lifestyle shots) or already fills >= 80 % of the
// frame were skipped.
//
// Usage: npx tsx scripts/apply-trimmed-gvs-main-photos.ts --dry-run | (no flag = apply)
import { prisma } from "../src/lib/prisma";

const DRY_RUN = process.argv.includes("--dry-run");

const TRIMMED: { code: string; url: string }[] = [
  { code: "GVS-10179", url: "/uploads/products/GVS-10179/trim-033d7875f4.jpg" },
  { code: "GVS-10230", url: "/uploads/products/GVS-10230/trim-18d39ba2c4.jpg" },
  { code: "GVS-11022", url: "/uploads/products/GVS-11022/trim-2793a250b6.jpg" },
  { code: "GVS-11848", url: "/uploads/products/GVS-11848/trim-7d47fa2f9c.jpg" },
  { code: "GVS-12005", url: "/uploads/products/GVS-12005/trim-8695a2d767.jpg" },
  { code: "GVS-12012", url: "/uploads/products/GVS-12012/trim-29a6fa5167.jpg" },
  { code: "GVS-12081", url: "/uploads/products/GVS-12081/trim-f286015db0.jpg" },
  { code: "GVS-12098", url: "/uploads/products/GVS-12098/trim-ea6f1d9355.jpg" },
  { code: "GVS-12104", url: "/uploads/products/GVS-12104/trim-c19015a6ba.jpg" },
  { code: "GVS-12111", url: "/uploads/products/GVS-12111/trim-cc95c8dfa9.jpg" },
  { code: "GVS-12173", url: "/uploads/products/GVS-12173/trim-31561a9e3a.jpg" },
  { code: "GVS-12470", url: "/uploads/products/GVS-12470/trim-01b60dace7.jpg" },
  { code: "GVS-12524", url: "/uploads/products/GVS-12524/trim-cecffe3e04.jpg" },
  { code: "GVS-12531", url: "/uploads/products/GVS-12531/trim-4684ca2c74.jpg" },
  { code: "GVS-13286", url: "/uploads/products/GVS-13286/trim-f6e3cbafd7.jpg" },
  { code: "GVS-13705", url: "/uploads/products/GVS-13705/trim-521816d7f7.jpg" },
  { code: "GVS-13736", url: "/uploads/products/GVS-13736/trim-dda975cae8.jpg" },
  { code: "GVS-13774", url: "/uploads/products/GVS-13774/trim-c104df4888.jpg" },
  { code: "GVS-14429", url: "/uploads/products/GVS-14429/trim-65cb6c2adc.jpg" },
  { code: "GVS-1481113", url: "/uploads/products/GVS-1481113/trim-d9dc789f5f.jpg" },
  { code: "GVS-1482493", url: "/uploads/products/GVS-1482493/trim-3f42079724.jpg" },
  { code: "GVS-1482509", url: "/uploads/products/GVS-1482509/trim-62bd65d2c2.jpg" },
  { code: "GVS-14849", url: "/uploads/products/GVS-14849/trim-a402126455.jpg" },
  { code: "GVS-251745", url: "/uploads/products/GVS-251745/trim-15bdbaffca.jpg" },
  { code: "GVS-251745-DEFECT", url: "/uploads/products/GVS-251745-DEFECT/trim-1407ffe842.jpg" },
  { code: "GVS-251981", url: "/uploads/products/GVS-251981/trim-e614c4a21f.jpg" },
  { code: "GVS-253091", url: "/uploads/products/GVS-253091/trim-20f775fe30.jpg" },
  { code: "GVS-253473", url: "/uploads/products/GVS-253473/trim-1e7e37d9c1.jpg" },
  { code: "GVS-253480", url: "/uploads/products/GVS-253480/trim-97f462fc01.jpg" },
  { code: "GVS-253756", url: "/uploads/products/GVS-253756/trim-904adc42df.jpg" },
  { code: "GVS-254395", url: "/uploads/products/GVS-254395/trim-1d7a24b86a.jpg" },
  { code: "GVS-254494", url: "/uploads/products/GVS-254494/trim-7d0da6c0c4.jpg" },
  { code: "GVS-255033", url: "/uploads/products/GVS-255033/trim-7157f746f6.jpg" },
  { code: "GVS-255071", url: "/uploads/products/GVS-255071/trim-6f7cb3f17d.jpg" },
  { code: "GVS-255101", url: "/uploads/products/GVS-255101/trim-fe62f45e0e.jpg" },
  { code: "GVS-255385", url: "/uploads/products/GVS-255385/trim-f22ca4b3ee.jpg" },
  { code: "GVS-255385-DEFECT", url: "/uploads/products/GVS-255385-DEFECT/trim-5d918bb60a.jpg" },
  { code: "GVS-2554846", url: "/uploads/products/GVS-2554846/trim-0f345cacda.jpg" },
  { code: "GVS-2554853", url: "/uploads/products/GVS-2554853/trim-89d5eedf10.jpg" },
  { code: "GVS-255620", url: "/uploads/products/GVS-255620/trim-49576fa5ad.jpg" },
  { code: "GVS-2559544", url: "/uploads/products/GVS-2559544/trim-d03d0016aa.jpg" },
  { code: "GVS-255972", url: "/uploads/products/GVS-255972/trim-b22c5d0870.jpg" },
  { code: "GVS-2559933", url: "/uploads/products/GVS-2559933/trim-0f61fe8e49.jpg" },
  { code: "GVS-256115", url: "/uploads/products/GVS-256115/trim-9d291d6522.jpg" },
  { code: "GVS-256115-DEFECT", url: "/uploads/products/GVS-256115-DEFECT/trim-2c2732aa18.jpg" },
  { code: "GVS-256122", url: "/uploads/products/GVS-256122/trim-2a30ea6c8d.jpg" },
  { code: "GVS-256122-DEFECT", url: "/uploads/products/GVS-256122-DEFECT/trim-4284dc86e1.jpg" },
  { code: "GVS-256184", url: "/uploads/products/GVS-256184/trim-f2c66bab65.jpg" },
  { code: "GVS-256191", url: "/uploads/products/GVS-256191/trim-5acf01e0e8.jpg" },
  { code: "GVS-256221", url: "/uploads/products/GVS-256221/trim-2b43a3d6d2.jpg" },
  { code: "GVS-256221-DEFECT", url: "/uploads/products/GVS-256221-DEFECT/trim-1418944cc7.jpg" },
  { code: "GVS-256238", url: "/uploads/products/GVS-256238/trim-75d5db5e70.jpg" },
  { code: "GVS-256306", url: "/uploads/products/GVS-256306/trim-1482de789c.jpg" },
  { code: "GVS-256412", url: "/uploads/products/GVS-256412/trim-68d0620376.jpg" },
  { code: "GVS-256429", url: "/uploads/products/GVS-256429/trim-8d3985e67c.jpg" },
  { code: "GVS-256429-DEFECT", url: "/uploads/products/GVS-256429-DEFECT/trim-1264958308.jpg" },
  { code: "GVS-256658", url: "/uploads/products/GVS-256658/trim-5650add8ea.jpg" },
  { code: "GVS-256795", url: "/uploads/products/GVS-256795/trim-f3aec13782.jpg" },
  { code: "GVS-256795-DEFECT", url: "/uploads/products/GVS-256795-DEFECT/trim-568940215a.jpg" },
  { code: "GVS-257020", url: "/uploads/products/GVS-257020/trim-099bbe1af1.jpg" },
  { code: "GVS-3012017", url: "/uploads/products/GVS-3012017/trim-4e20ff3759.jpg" },
  { code: "GVS-3013175", url: "/uploads/products/GVS-3013175/trim-5dd8a70b35.jpg" },
  { code: "GVS-3013182", url: "/uploads/products/GVS-3013182/trim-90aa33840c.jpg" },
  { code: "GVS-6555893", url: "/uploads/products/GVS-6555893/trim-3dba3d96c2.jpg" },
  { code: "GVS-7118671", url: "/uploads/products/GVS-7118671/trim-cebb43008a.jpg" },
  { code: "GVS-7251943", url: "/uploads/products/GVS-7251943/trim-2e4c1a300a.jpg" },
];

async function main() {
  let changed = 0;
  for (const t of TRIMMED) {
    const product = await prisma.product.findUnique({ where: { code: t.code }, include: { images: { orderBy: { sortOrder: "asc" } } } });
    const main = product?.images[0];
    if (!product || !main) {
      console.log(`  [skip] ${t.code}`);
      continue;
    }
    if (main.url === t.url) continue;
    console.log(`  ${t.code}: ${main.url.split("/").pop()} -> ${t.url.split("/").pop()}`);
    if (DRY_RUN) continue;
    await prisma.productImage.update({ where: { id: main.id }, data: { url: t.url } });
    changed++;
  }
  console.log(`\nDone. ${changed} main photos swapped.`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
