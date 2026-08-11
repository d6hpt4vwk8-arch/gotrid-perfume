// Second pass on GVS Cosmetics photo quality: the first pass
// (scripts/upgrade-gvs-images.ts) only replaced products whose name scored
// a near-exact (>=0.95) token match against a scraped candidate label.
// Everything below that threshold was left on its original low-res
// spreadsheet photo — mostly because the candidate label lacked a size
// suffix ("Teca Lifting Moisture Cream" vs our "..., 50 ml"), not because
// the match was actually wrong.
//
// This pass replaces automated scoring with direct manual verification:
// each brand's FULL official catalog was fetched (VVBETTER + Dr. Althea via
// their Shopify /products.json, Esthetic House/CP-1 via its Cafe24 category
// pages + site search) and every one of our remaining low-res products was
// hand-matched against it by name. Products with no real counterpart in the
// current catalog (discontinued lines, or genuinely ambiguous pack-size
// items like "1pcs*20ml" vs a 20-count box) are left out entirely rather
// than guessed.
//
// Usage: npx tsx scripts/upgrade-gvs-images-batch2.ts --dry-run | (no flag = apply)
import { prisma } from "../src/lib/prisma";
import { downloadProductImages } from "../src/lib/import/download-images";

const DRY_RUN = process.argv.includes("--dry-run");

const FIXES: { code: string; imageUrl: string; note: string }[] = [
  // --- Esthetic House / CP-1 (min8852.cafe24.com) ---
  { code: "GVS-14856", imageUrl: "https://min8852.cafe24.com/web/product/medium/202601/cb719e5601c4696026d4921e1ae5d03d.jpg", note: "Keratin Intensive Fill-up No-wash Treatment 150ml" },
  { code: "GVS-14795", imageUrl: "https://min8852.cafe24.com/web/product/medium/202601/cef4b735cbea22d714c27aa9448004f7.jpg", note: "Keratin Intensive Fill-up Hair Conditioner 100ml" },
  { code: "GVS-14788", imageUrl: "https://min8852.cafe24.com/web/product/medium/202601/cef4b735cbea22d714c27aa9448004f7.jpg", note: "Keratin Intensive Fill-up Hair Conditioner 500ml" },
  { code: "GVS-14849", imageUrl: "https://min8852.cafe24.com/web/product/medium/202601/f2d82bfe0c44877c5e4e924eb3487d3e.jpg", note: "Keratin Intensive Fill-up Hair Mask 200ml" },
  { code: "GVS-14771", imageUrl: "https://min8852.cafe24.com/web/product/medium/202601/d304c6db5e6e172f09594b144b92bdf6.jpg", note: "Keratin Intensive Fill-up Hair Shampoo 100ml" },
  { code: "GVS-14764", imageUrl: "https://min8852.cafe24.com/web/product/medium/202601/d304c6db5e6e172f09594b144b92bdf6.jpg", note: "Keratin Intensive Fill-up Hair Shampoo 500ml" },
  { code: "GVS-11848", imageUrl: "https://min8852.cafe24.com/web/product/medium/201909/cc052c7f980d84181fe8c90a073756ad.jpg", note: "3 Seconds Hair Fill-Up Ampoule 170ml" },
  { code: "GVS-13774", imageUrl: "https://min8852.cafe24.com/web/product/medium/202302/2782c1d40a13c5b46ac98a4ece7cb1d6.jpg", note: "3 Seconds Hair Fill-Up Conditioner 100ml" },
  { code: "GVS-13736", imageUrl: "https://min8852.cafe24.com/web/product/medium/202302/3e7cfbbb31f7854f6bd303773fe8a031.jpg", note: "3 Seconds Hair Fill-Up Conditioner 500ml" },
  { code: "GVS-12531", imageUrl: "https://min8852.cafe24.com/web/product/medium/202203/001226a243f264d90097677713a2a7c1.jpg", note: "3 Seconds Hair Fill-Up Shampoo 100ml" },
  { code: "GVS-12524", imageUrl: "https://min8852.cafe24.com/web/product/medium/202010/24ecb553f6a011ad5aa7d56f095f7762.jpg", note: "3 Seconds Hair Fill-Up Shampoo 500ml" },
  { code: "GVS-13699", imageUrl: "https://min8852.cafe24.com/web/product/medium/202304/7fb04b19e223bf114b65a97b624581f9.jpg", note: "Aquaxyl Complex Intense Moisture Conditioner 500ml" },
  { code: "GVS-13668", imageUrl: "https://min8852.cafe24.com/web/product/medium/202304/65166983befda0825dfa197534aeaa36.jpg", note: "Aquaxyl Complex Intense Moisture Shampoo 500ml" },
  { code: "GVS-13286", imageUrl: "https://min8852.cafe24.com/web/product/medium/202203/bff9b3eccba84c25ce570c202ed4eb59.jpg", note: "Cool Mint Shampoo 100ml" },
  { code: "GVS-12074", imageUrl: "https://min8852.cafe24.com/web/product/medium/201909/e2091d7b05b2c5ae7857c4c6c8fa3b53.jpg", note: "Cool Mint Shampoo 500ml" },
  { code: "GVS-13279", imageUrl: "https://min8852.cafe24.com/web/product/medium/202203/22faf48661e44538fbc8f2363fe815a4.jpg", note: "Ginger Purifying Conditioner 100ml" },
  { code: "GVS-12012", imageUrl: "https://min8852.cafe24.com/web/product/medium/20191219/dd4abf534e80c58492d65f58a97fdeb3.jpg", note: "Ginger Purifying Conditioner 500ml" },
  { code: "GVS-13262", imageUrl: "https://min8852.cafe24.com/web/product/medium/202203/025e5770cc0b0442162af2a81150c962.jpg", note: "Ginger Purifying Shampoo 100ml" },
  { code: "GVS-12005", imageUrl: "https://min8852.cafe24.com/web/product/medium/20191219/e00e91dc63cc0623c04ac68421bced72.jpg", note: "Ginger Purifying Shampoo 500ml" },
  { code: "GVS-14535", imageUrl: "https://min8852.cafe24.com/web/product/medium/202408/5409dd36a13a95883e347a21e8baa60a.jpg", note: "Head Spa Pink Salt Scalp Scaler (site: 230ml)" },
  { code: "GVS-10933", imageUrl: "https://min8852.cafe24.com/web/product/medium/202408/250e78ca8a05ce14aca7b9ca04160750.jpg", note: "Head Spa Scalp Scaler 210ml" },
  { code: "GVS-541881", imageUrl: "https://min8852.cafe24.com/web/product/medium/201908/8b86b4b532e3957b7829a0f30cf73133.jpg", note: "Keratin Concentrate Ampoule 10ml" },
  { code: "GVS-10230", imageUrl: "https://min8852.cafe24.com/web/product/medium/201908/b17359cd5a33439587fb573a91eb3e31.jpg", note: "Keratin Concentrate Ampoule 80ml" },
  { code: "GVS-14429", imageUrl: "https://min8852.cafe24.com/web/product/medium/202606/c13d07e3882c5b327e3830f422b873a1.jpg", note: "LPP Collagen Repair Hair Mask (site: 210ml)" },
  { code: "GVS-11251", imageUrl: "https://min8852.cafe24.com/web/product/medium/202401/24a7d8bc6f8cea67a7fa81a5faf06684.jpg", note: "Premium Hair Treatment 250ml" },
  { code: "GVS-10551", imageUrl: "https://min8852.cafe24.com/web/product/medium/201908/eb58ddfee578f9f35cb71583ad73ffb2.jpg", note: "Premium Hair Treatment 25ml" },
  { code: "GVS-11022", imageUrl: "https://min8852.cafe24.com/web/product/medium/202403/9267d6921800ada906dcd391cc52bf8f.jpg", note: "Premium Silk Ampoule 150ml" },
  { code: "GVS-10582", imageUrl: "https://min8852.cafe24.com/web/product/medium/202403/1bc7e189dee3cfc8deb3498508a77708.jpg", note: "Premium Silk Ampoule 1pcs*20ml" },
  { code: "GVS-10179", imageUrl: "https://min8852.cafe24.com/web/product/medium/201908/e831e6dabef8fc3f3374dbc82e53e6b3.jpg", note: "Raspberry Treatment Vinegar 500ml" },
  { code: "GVS-14016", imageUrl: "https://min8852.cafe24.com/web/product/medium/202402/0c25be0733d75508cb1b70859cbfbd95.jpg", note: "Tea Tree Mint Shampoo 500ml" },
  { code: "GVS-13996", imageUrl: "https://min8852.cafe24.com/web/product/big/202308/20d7c0a5920928a850ab0d0c91464f42.jpg", note: "Toxheal Red Glycolic AHA·BHA·PHA Toner 180ml" },

  // --- Dr. Althea (doctoraltheaglobal.com) ---
  { code: "GVS-256795", imageUrl: "https://cdn.shopify.com/s/files/1/0082/1346/3093/files/147.jpg?v=1786083592", note: "147 Barrier Cream" },
  { code: "GVS-255033", imageUrl: "https://cdn.shopify.com/s/files/1/0082/1346/3093/files/15_f702a9e0-c950-4726-b9cf-8e7b5bf40a97.jpg?v=1786083592", note: "15% Calamine Spot Powder" },
  { code: "GVS-256283", imageUrl: "https://cdn.shopify.com/s/files/1/0082/1346/3093/files/345_eab26fc7-95b8-4f7b-85ad-44419950bc01.jpg?v=1786083592", note: "345 Relief Cream Mask" },
  { code: "GVS-256115", imageUrl: "https://cdn.shopify.com/s/files/1/0082/1346/3093/files/345_100ml.jpg?v=1786083592", note: "345 Relief Cream Mist 100ml" },
  { code: "GVS-256122", imageUrl: "https://cdn.shopify.com/s/files/1/0082/1346/3093/files/345_100ml.jpg?v=1786083592", note: "345 Relief Cream Mist 60ml" },
  { code: "GVS-256429", imageUrl: "https://cdn.shopify.com/s/files/1/0082/1346/3093/files/345_ac454af4-b078-4619-a63a-1201465548e9.jpg?v=1786083592", note: "345 Relief Cream 15ml" },
  { code: "GVS-256221", imageUrl: "https://cdn.shopify.com/s/files/1/0082/1346/3093/files/345_ac454af4-b078-4619-a63a-1201465548e9.jpg?v=1786083592", note: "345 Relief Cream (Renewal) 50ml" },
  { code: "GVS-255736", imageUrl: "https://cdn.shopify.com/s/files/1/0082/1346/3093/files/190152587c4378477e309fce268edbea.jpg?v=1786083592", note: "Jelly Seal Dewy Mask" },
  { code: "GVS-256412", imageUrl: "https://cdn.shopify.com/s/files/1/0082/1346/3093/files/5000.jpg?v=1786083592", note: "Reju 5000 Cream" },
  { code: "GVS-255811", imageUrl: "https://cdn.shopify.com/s/files/1/0082/1346/3093/files/2e3299364f14536765c8aece444e2700.jpg?v=1786083592", note: "Vita Glow Mask" },

  // --- VVBETTER (vvbetter.com) ---
  { code: "GVS-3012017", imageUrl: "https://cdn.shopify.com/s/files/1/0659/1234/0722/files/41.webp?v=1739779111", note: "Aha Boosting Toner 200ml" },
  { code: "GVS-5904008", imageUrl: "https://cdn.shopify.com/s/files/1/0659/1234/0722/files/12_dfa32163-5b5d-4867-82a4-b9a084ebb578.png?v=1739778970", note: "Daily Airfit Sunscreen 1ml sample" },
  { code: "GVS-5903568", imageUrl: "https://cdn.shopify.com/s/files/1/0659/1234/0722/files/12_dfa32163-5b5d-4867-82a4-b9a084ebb578.png?v=1739778970", note: "Daily Airfit Sunscreen SPF50+" },
  { code: "GVS-1481113", imageUrl: "https://cdn.shopify.com/s/files/1/0659/1234/0722/files/31_173d80d0-1138-4d78-b4d2-f08777b90ddd.png?v=1728007278", note: "Firming Eye Cream 1ml sample" },
  { code: "GVS-2559933", imageUrl: "https://cdn.shopify.com/s/files/1/0659/1234/0722/files/31_173d80d0-1138-4d78-b4d2-f08777b90ddd.png?v=1728007278", note: "Firming Eye Cream 30ml" },
  { code: "GVS-5904305", imageUrl: "https://cdn.shopify.com/s/files/1/0659/1234/0722/files/17_48eba26b-4d03-4176-afab-be1a23e83c84.png?v=1739779018", note: "Gentle Deep Cleansing Oil 200ml" },
  { code: "GVS-9177655", imageUrl: "https://cdn.shopify.com/s/files/1/0659/1234/0722/files/22_c9eaac44-7ea2-4a86-8d3a-2412835e7b9f.png?v=1728007278", note: "Gentle Purifying Mud Mask 60ml" },
  { code: "GVS-7119623", imageUrl: "https://cdn.shopify.com/s/files/1/0659/1234/0722/files/Untitled_300_x_300_px_-9.png?v=1751517920", note: "Jeju Yuja Balancing Pad mini set (pouch)" },
  { code: "GVS-1488075", imageUrl: "https://cdn.shopify.com/s/files/1/0659/1234/0722/files/Untitled_300_x_300_px.png?v=1739343731", note: "Jeju Yuja Balancing Bubble Cleanser 145ml" },
  { code: "GVS-7119180", imageUrl: "https://cdn.shopify.com/s/files/1/0659/1234/0722/files/1_7a3b7ecb-c6f2-4675-9b9e-7b12e659b2a1.png?v=1728007278", note: "Jeju Yuja Cera Balancing Cream 50ml" },
  { code: "GVS-1482509", imageUrl: "https://cdn.shopify.com/s/files/1/0659/1234/0722/files/33.png?v=1728007278", note: "Soothing Cleansing Foam 120ml" },
  { code: "GVS-1482493", imageUrl: "https://cdn.shopify.com/s/files/1/0659/1234/0722/files/33.png?v=1728007278", note: "Soothing Cleansing Foam 2ml sample" },
  { code: "GVS-2559544", imageUrl: "https://cdn.shopify.com/s/files/1/0659/1234/0722/files/38.webp?v=1739779083", note: "Teca Lifting Moisture Cream 2ml sample" },
  { code: "GVS-2554853", imageUrl: "https://cdn.shopify.com/s/files/1/0659/1234/0722/files/38.webp?v=1739779083", note: "Teca Lifting Moisture Cream 50ml" },
  { code: "GVS-2554846", imageUrl: "https://cdn.shopify.com/s/files/1/0659/1234/0722/files/Untitled_300_x_300_px_8148db0a-d983-4096-8662-a8d4933a393c.png?v=1739783519", note: "Teca Lifting Moisture Serum 30ml" },
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
