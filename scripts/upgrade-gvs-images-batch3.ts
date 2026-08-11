// Third pass on GVS Cosmetics photo quality. The first two passes only
// searched each brand's own primary storefront; several of our remaining
// low-res products turned out to be genuinely discontinued THERE but still
// sold (and photographed) by established K-beauty resellers (YesStyle,
// Stylevana, Kosmos Beauty Lab, CareToBeauty, Olive Young Global) or, in two
// cases, by the manufacturer's own site under a URL/path that didn't show
// up in the earlier category/product-feed crawl (Esthetic House's Toxheal
// Peeling Serum was a plain 404 from the CP-1 category page but resolves
// directly under a different shop path on the same domain).
//
// Every pairing below was verified by exact product name against a named,
// reputable retailer's own product page (not a marketplace/aggregator
// listing) — same "rock-solid only" bar as the previous two passes. One
// item (CP-1 3 Seconds Hair Fill-Up Ampoule, 1pcs*13ml) could not be
// confirmed as a single-unit photo (every retailer only sells/photographs
// the 20-count box) and is deliberately left out.
//
// Usage: npx tsx scripts/upgrade-gvs-images-batch3.ts --dry-run | (no flag = apply)
import { prisma } from "../src/lib/prisma";
import { downloadProductImages } from "../src/lib/import/download-images";

const DRY_RUN = process.argv.includes("--dry-run");

const FIXES: { code: string; imageUrl: string; note: string }[] = [
  // --- Esthetic House / CP-1 ---
  { code: "GVS-12111", imageUrl: "https://d1flfk77wl2xk4.cloudfront.net/Assets/93/311/XXL_p0174731193.jpg", note: "Bright Complex Intense Nourishing Conditioner 100ml (YesStyle)" },
  { code: "GVS-12098", imageUrl: "https://d1flfk77wl2xk4.cloudfront.net/Assets/51/706/XXL_p0110570651.jpg", note: "Bright Complex Intense Nourishing Conditioner 500ml jumbo (YesStyle)" },
  { code: "GVS-12104", imageUrl: "https://www.kosmosbeauty.com/cdn/shop/files/CP-1_Esthetic_House_Bright_Complex_Intense_Nourishing_Shampoo_100ml.png?v=1768562941", note: "Bright Complex Intense Nourishing Shampoo 100ml (Kosmos Beauty Lab)" },
  { code: "GVS-12081", imageUrl: "https://d1flfk77wl2xk4.cloudfront.net/Assets/89/097/L_p0090509789.jpg", note: "Bright Complex Intense Nourishing Shampoo 500ml (YesStyle)" },
  { code: "GVS-14757", imageUrl: "https://unboxshop.ru/upload/iblock/018/3bkw4yolmhrqo3sy39t4b6f4exqen2wv.png", note: "Detox Purifying Scalp Refresh Conditioner 100ml (Unboxshop)" },
  { code: "GVS-14740", imageUrl: "https://unboxshop.ru/upload/resize_cache/iblock/dc6/1200_1200_140cd750bba9870f18aada2478b24840a/7whi3ju3w3zos44ymdsxc491w9338v7g.png", note: "Detox Purifying Scalp Refresh Conditioner 500ml (Unboxshop)" },
  { code: "GVS-14733", imageUrl: "https://hollyshop.ru/upload/iblock/0d4/m6q0b8qzl3f0bkb4qcwytpg3tbr4obc5/500.jpg", note: "Detox Purifying Scalp Refresh Shampoo 100ml (Hollyshop)" },
  { code: "GVS-14726", imageUrl: "https://hollyshop.ru/upload/iblock/0d4/m6q0b8qzl3f0bkb4qcwytpg3tbr4obc5/500.jpg", note: "Detox Purifying Scalp Refresh Shampoo 500ml (Hollyshop)" },
  { code: "GVS-12470", imageUrl: "https://www.kosmosbeauty.com/cdn/shop/products/CP-1_Esthetic_House_Peeling_Ampoule_20ml.png?v=1768569144", note: "Head Spa Peeling Ampoule 1pcs*20ml (Kosmos Beauty Lab, confirmed single-ampoule photo)" },
  { code: "GVS-12173", imageUrl: "https://min8852.cafe24.com/web/product/big/202103/fc76d41d866c03fdccf39942204882e0.jpg", note: "Toxheal Red Glycolic Peeling Serum 100ml (official site, hidden shop3 path)" },

  // --- Dr. Althea ---
  { code: "GVS-256276", imageUrl: "https://cdn-image.oliveyoung.com/prdtImg/1609/955a5a67-f3e4-4804-8911-119b7fddf8f5.jpg?RS=1500x1500&AR=0&QT=80", note: "Dear.A Cool Fit Primer (Olive Young Global)" },
  { code: "GVS-255293", imageUrl: "https://www.caretobeauty.com/media/catalog/product/d/r/dr-althea-2-salicylic-acid-clear-pad-x65.jpg", note: "2% Salicylic Acid Clear Pad (CareToBeauty)" },
  { code: "GVS-253091", imageUrl: "https://www.caretobeauty.com/media/catalog/product/d/r/dr-althea-dear-a-face-blur-finishing-powder-8g.jpg", note: "Dear.A Face Blur Finishing Powder (CareToBeauty)" },
  { code: "GVS-254494", imageUrl: "https://d1flfk77wl2xk4.cloudfront.net/Assets/94/966/XXL_p0208096694.jpg", note: "Free Moment Green Calming Serum Mist (YesStyle)" },
  { code: "GVS-251981", imageUrl: "https://d1flfk77wl2xk4.cloudfront.net/Assets/dr-althea-marine-anti-blemish-mask-set-27g-x-5-pcs/14/049/XXL_p0150704914.jpg", note: "Marine Anti-Blemish Mask (YesStyle)" },
  { code: "GVS-253480", imageUrl: "https://d1flfk77wl2xk4.cloudfront.net/Assets/dr-althea-natural-radiance-essence-30ml/00/493/XXL_p0201849300.jpg", note: "Natural Radiance Essence (YesStyle)" },
  { code: "GVS-7251943", imageUrl: "https://www.skincupid.co.uk/cdn/shop/files/Dr.Althea-Oasis_Soothing_Mask.jpg?v=1760352216", note: "Oasis Soothing Mask (Skin Cupid)" },
  { code: "GVS-253473", imageUrl: "https://d1flfk77wl2xk4.cloudfront.net/Assets/dr-althea-skin-relief-essence-30ml/99/492/XXL_p0201849299.jpg", note: "Skin Relief Essence (YesStyle)" },
  { code: "GVS-254395", imageUrl: "https://d1flfk77wl2xk4.cloudfront.net/Assets/dr-althea-to-be-youthful-eye-serum-25ml/31/216/XXL_p0129721631.png", note: "To Be Youthful Eye Serum (YesStyle)" },
  { code: "GVS-255972", imageUrl: "https://d1flfk77wl2xk4.cloudfront.net/Assets/dr-althea-aqua-glowing-sunscreen-45ml/97/882/XXL_p0225188297.jpg", note: "Aqua Glowing Sunscreen (YesStyle)" },

  // --- VVBETTER ---
  { code: "GVS-2555218", imageUrl: "https://static.ksisters.com/public/skus/l/b3cd31486255bba3e7193065566b54f6_t8frahjl_a3a6cadbe0cbaa.webp", note: "Konjac Sponge 5g (Ksisters)" },
];

async function main() {
  let applied = 0;
  let failed = 0;
  for (const fix of FIXES) {
    const product = await prisma.product.findUnique({ where: { code: fix.code } });
    if (!product) {
      console.log(`  [skip] product not found: ${fix.code}`);
      continue;
    }
    console.log(`  ${fix.code} (${product.name}) <- ${fix.note}`);
    if (DRY_RUN) continue;

    const { urls, errors } = await downloadProductImages(product.code, fix.imageUrl);
    if (urls.length === 0) {
      failed++;
      console.log(`    [error] download failed: ${errors.join("; ")}`);
      continue;
    }
    await prisma.productImage.deleteMany({ where: { productId: product.id } });
    await prisma.productImage.create({ data: { productId: product.id, url: urls[0], sortOrder: 0 } });
    applied++;
  }
  console.log(`\nDone. ${applied}/${FIXES.length} applied, ${failed} failed.`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
