// High-resolution pass over the GVS Cosmetics photos (owner request 2026-10-09:
// "all photos in very high quality"). An audit found 81 of 118 below 800 px
// (41 CP-1 shots at 300x300). Sources are the brands' OWN storefronts:
//  - Dr. Althea: doctoraltheaglobal.com Shopify catalog, original size 1400x1400,
//    matched by exact product title (strict) or, for masks / 345 cream / Reju 5000,
//    after a side-by-side visual check against our current photo.
//  - CP-1 / Esthetic House: official store min8852.cafe24.com, "big" size
//    1000x1000, matched by perceptual hash of our current photo against the
//    store's own thumbnails (distance <= 2), then KEPT only where the store's
//    full-size main photo is still the clean pack shot (hash distance to our
//    current photo <= 10). 13 products whose "big" image is a Korean ad banner
//    or lifestyle shot were deliberately left out.
// A replacement is only applied when the downloaded file really is >= MIN_LONG_SIDE
// px on its long side AND larger than what we have; otherwise the old photo stays.
//
// Usage: npx tsx scripts/upgrade-gvs-images-hq.ts --dry-run | (no flag = apply)
import path from "node:path";
import sharp from "sharp";
import { prisma } from "../src/lib/prisma";
import { downloadProductImages } from "../src/lib/import/download-images";

const DRY_RUN = process.argv.includes("--dry-run");
const MIN_LONG_SIDE = 1000;

const FIXES: { code: string; imageUrl: string; note: string }[] = [
  { code: "GVS-255385", imageUrl: "https://cdn.shopify.com/s/files/1/0082/1346/3093/files/5ac821e255987f9742b5c8a8016f8877_64c53aba-892d-40b6-8198-ad56b59a7a30.jpg?v=1789024159", note: "doctoraltheaglobal.com: Vitamin C Boosting Serum" },
  { code: "GVS-256191", imageUrl: "https://cdn.shopify.com/s/files/1/0082/1346/3093/files/9c9ed4d504670d9990d143597e9d03b9.jpg?v=1789024158", note: "doctoraltheaglobal.com: Aqua Marine Deep Serum" },
  { code: "GVS-253756", imageUrl: "https://cdn.shopify.com/s/files/1/0082/1346/3093/files/6af57fa6fe74b922e458c9ad5b97cda0.jpg?v=1789024158", note: "doctoraltheaglobal.com: Premium Quick Step Sebum Cleanser" },
  { code: "GVS-255101", imageUrl: "https://cdn.shopify.com/s/files/1/0082/1346/3093/files/5cbf4a7cd39d341854411777ed3ffa46.jpg?v=1789024158", note: "doctoraltheaglobal.com: Gentle Vitamin C Serum" },
  { code: "GVS-255385-DEFECT", imageUrl: "https://cdn.shopify.com/s/files/1/0082/1346/3093/files/5ac821e255987f9742b5c8a8016f8877_64c53aba-892d-40b6-8198-ad56b59a7a30.jpg?v=1789024159", note: "doctoraltheaglobal.com: Vitamin C Boosting Serum" },
  { code: "GVS-256115", imageUrl: "https://cdn.shopify.com/s/files/1/0082/1346/3093/files/345_100ml_f1f54b3d-5ccf-438a-9e06-90ce3148f55a.jpg?v=1788504508", note: "doctoraltheaglobal.com: 345 Relief Cream Mist" },
  { code: "GVS-256115-DEFECT", imageUrl: "https://cdn.shopify.com/s/files/1/0082/1346/3093/files/345_100ml_f1f54b3d-5ccf-438a-9e06-90ce3148f55a.jpg?v=1788504508", note: "doctoraltheaglobal.com: 345 Relief Cream Mist" },
  { code: "GVS-256122", imageUrl: "https://cdn.shopify.com/s/files/1/0082/1346/3093/files/345_100ml_f1f54b3d-5ccf-438a-9e06-90ce3148f55a.jpg?v=1788504508", note: "doctoraltheaglobal.com: 345 Relief Cream Mist" },
  { code: "GVS-256122-DEFECT", imageUrl: "https://cdn.shopify.com/s/files/1/0082/1346/3093/files/345_100ml_f1f54b3d-5ccf-438a-9e06-90ce3148f55a.jpg?v=1788504508", note: "doctoraltheaglobal.com: 345 Relief Cream Mist" },
  { code: "GVS-256184", imageUrl: "https://cdn.shopify.com/s/files/1/0082/1346/3093/files/09f39d7d117aa6744019d6a2350434c5.jpg?v=1789024158", note: "doctoraltheaglobal.com: Aqua Marine Jelly Mist" },
  { code: "GVS-256238", imageUrl: "https://cdn.shopify.com/s/files/1/0082/1346/3093/files/ABC_013d819a-3869-4456-a1e4-4f1621e5c49f.jpg?v=1789024158", note: "doctoraltheaglobal.com: ABC Glow Whipped Serum" },
  { code: "GVS-256658", imageUrl: "https://cdn.shopify.com/s/files/1/0082/1346/3093/files/90950269a807258b55e8a31ce39a580a.jpg?v=1789024158", note: "doctoraltheaglobal.com: Retinol Flat Iron Eye Roller" },
  { code: "GVS-256795", imageUrl: "https://cdn.shopify.com/s/files/1/0082/1346/3093/files/147_2e4c0c89-7839-4c67-95ba-336c8a0a4772.jpg?v=1788504508", note: "doctoraltheaglobal.com: 147 Barrier Cream" },
  { code: "GVS-256795-DEFECT", imageUrl: "https://cdn.shopify.com/s/files/1/0082/1346/3093/files/147_2e4c0c89-7839-4c67-95ba-336c8a0a4772.jpg?v=1788504508", note: "doctoraltheaglobal.com: 147 Barrier Cream" },
  { code: "GVS-257020", imageUrl: "https://cdn.shopify.com/s/files/1/0082/1346/3093/files/d9feeacd2a7176c550ac2fcbf62a5035.jpg?v=1789024159", note: "doctoraltheaglobal.com: Melaclear Cream" },
  { code: "GVS-256221", imageUrl: "https://cdn.shopify.com/s/files/1/0082/1346/3093/files/345_1743b751-f56b-4476-a457-a10f33f0090b.jpg?v=1788504508", note: "doctoraltheaglobal.com: 345 Relief Cream" },
  { code: "GVS-256221-DEFECT", imageUrl: "https://cdn.shopify.com/s/files/1/0082/1346/3093/files/345_1743b751-f56b-4476-a457-a10f33f0090b.jpg?v=1788504508", note: "doctoraltheaglobal.com: 345 Relief Cream" },
  { code: "GVS-256429", imageUrl: "https://cdn.shopify.com/s/files/1/0082/1346/3093/files/345_1743b751-f56b-4476-a457-a10f33f0090b.jpg?v=1788504508", note: "doctoraltheaglobal.com: 345 Relief Cream" },
  { code: "GVS-256429-DEFECT", imageUrl: "https://cdn.shopify.com/s/files/1/0082/1346/3093/files/345_1743b751-f56b-4476-a457-a10f33f0090b.jpg?v=1788504508", note: "doctoraltheaglobal.com: 345 Relief Cream" },
  { code: "GVS-256412", imageUrl: "https://cdn.shopify.com/s/files/1/0082/1346/3093/files/5000_7ae32a11-a9ab-43fd-8312-f410d7f4ecf8.jpg?v=1789024158", note: "doctoraltheaglobal.com: PDRN Reju 5000 Cream" },
  { code: "GVS-10933", imageUrl: "https://min8852.cafe24.com/web/product/big/202408/e7bd3adcfc0e9ad1d3344711a34e4a29.jpg", note: "min8852.cafe24.com (official CP-1 store) product_no=157: CP-1 티트리 솔트 두피 스케일러 210ml" },
  { code: "GVS-12531", imageUrl: "https://min8852.cafe24.com/web/product/big/202203/617084d81a4af27f3f30de541931b489.jpg", note: "min8852.cafe24.com (official CP-1 store) product_no=297: CP-1 쓰리세컨즈 헤어 필업 샴푸 100ml" },
  { code: "GVS-13262", imageUrl: "https://min8852.cafe24.com/web/product/big/202203/ef5d2d48df2a6f37724a9466d09f3c2e.jpg", note: "min8852.cafe24.com (official CP-1 store) product_no=295: CP-1 진저 퓨리파잉 샴푸 100ml" },
  { code: "GVS-13279", imageUrl: "https://min8852.cafe24.com/web/product/big/202203/86810ffebafe4101ae1b613172546cb7.jpg", note: "min8852.cafe24.com (official CP-1 store) product_no=296: CP-1 진저 퓨리파잉 컨디셔너 100ml" },
  { code: "GVS-13286", imageUrl: "https://min8852.cafe24.com/web/product/big/202203/6beba60b841e19aae4a7fe4f1698a90a.jpg", note: "min8852.cafe24.com (official CP-1 store) product_no=298: CP-1 쿨 민트 샴푸 100ml" },
  { code: "GVS-13668", imageUrl: "https://min8852.cafe24.com/web/product/big/202304/89f5838618f65bc6e0fbfd501b0d1d59.jpg", note: "min8852.cafe24.com (official CP-1 store) product_no=312: CP-1 아쿠악실 콤플렉스 인텐스 모이스처 샴푸 500ml" },
  { code: "GVS-13675", imageUrl: "https://min8852.cafe24.com/web/product/big/202304/1308c5ec97d05f6e902776cf7be2687c.jpg", note: "min8852.cafe24.com (official CP-1 store) product_no=314: CP-1 아쿠악실 콤플렉스 인텐스 모이스처 샴푸 100ml" },
  { code: "GVS-13699", imageUrl: "https://min8852.cafe24.com/web/product/big/202304/2d74a0fcfe7dba393c48667063c724bc.jpg", note: "min8852.cafe24.com (official CP-1 store) product_no=313: CP-1 아쿠악실 콤플렉스 인텐스 모이스처 컨디셔너 500ml" },
  { code: "GVS-13705", imageUrl: "https://min8852.cafe24.com/web/product/big/202304/df738c2615f4d5bb39594dc92c2c0675.jpg", note: "min8852.cafe24.com (official CP-1 store) product_no=315: CP-1 아쿠악실 콤플렉스 인텐스 모이스처 컨디셔너 100ml" },
  { code: "GVS-13736", imageUrl: "https://min8852.cafe24.com/web/product/big/202302/107a0cf3bd93c0881593d24de449168e.jpg", note: "min8852.cafe24.com (official CP-1 store) product_no=307: CP-1 쓰리세컨즈 헤어 필업 컨디셔너 500ml" },
  { code: "GVS-13774", imageUrl: "https://min8852.cafe24.com/web/product/big/202302/10616355a94ee7dc68f80fd1c29695ec.jpg", note: "min8852.cafe24.com (official CP-1 store) product_no=308: CP-1 쓰리세컨즈 헤어 필업 컨디셔너 100ml" },
  { code: "GVS-14016", imageUrl: "https://min8852.cafe24.com/web/product/big/202402/014270fcd63b07c80d03720b88a58b69.jpg", note: "min8852.cafe24.com (official CP-1 store) product_no=325: 씨피원 티트리 민트 샴푸 500ml" },
  { code: "GVS-14375", imageUrl: "https://min8852.cafe24.com/web/product/big/202402/718630787b778bb5fe3ea17d4ea2736e.jpg", note: "min8852.cafe24.com (official CP-1 store) product_no=329: 씨피원 볼륨 부스터 샴푸 500ml" },
  { code: "GVS-14382", imageUrl: "https://min8852.cafe24.com/web/product/big/202402/31ef65522ea54e888f135d2e59781f8b.jpg", note: "min8852.cafe24.com (official CP-1 store) product_no=330: 씨피원 볼륨 부스터 컨디셔너 500ml" },
  { code: "GVS-14429", imageUrl: "https://min8852.cafe24.com/web/product/big/202606/cd842a9b3d5926cea18992db60e65ac5.jpg", note: "min8852.cafe24.com (official CP-1 store) product_no=335: CP-1 엘피피 콜라겐 리페어 헤어 마스크 210ml" },
  { code: "GVS-14535", imageUrl: "https://min8852.cafe24.com/web/product/big/202408/92b431e8ff002a1871c6fb9db526803c.jpg", note: "min8852.cafe24.com (official CP-1 store) product_no=341: CP-1 핑크솔트 스케일러 230ml" },
  { code: "GVS-14764", imageUrl: "https://min8852.cafe24.com/web/product/big/202601/a47c5bd22a510fd017a83700bc74dfbc.jpg", note: "min8852.cafe24.com (official CP-1 store) product_no=348: 씨피원 케라틴 인텐시브 필업 헤어 샴푸" },
  { code: "GVS-14771", imageUrl: "https://min8852.cafe24.com/web/product/big/202601/a47c5bd22a510fd017a83700bc74dfbc.jpg", note: "min8852.cafe24.com (official CP-1 store) product_no=348: 씨피원 케라틴 인텐시브 필업 헤어 샴푸" },
  { code: "GVS-14788", imageUrl: "https://min8852.cafe24.com/web/product/big/202601/ef22b6fb43b14ff679d138c31987ca75.jpg", note: "min8852.cafe24.com (official CP-1 store) product_no=349: 씨피원 케라틴 인센티브 필업 헤어 컨디셔너" },
  { code: "GVS-14795", imageUrl: "https://min8852.cafe24.com/web/product/big/202601/ef22b6fb43b14ff679d138c31987ca75.jpg", note: "min8852.cafe24.com (official CP-1 store) product_no=349: 씨피원 케라틴 인센티브 필업 헤어 컨디셔너" },
  { code: "GVS-14849", imageUrl: "https://min8852.cafe24.com/web/product/big/202601/447104a3f4dd109b40158925f5e288c9.jpg", note: "min8852.cafe24.com (official CP-1 store) product_no=350: 씨피원 케라틴 인텐시브 필업 헤어 마스크" },
  { code: "GVS-14856", imageUrl: "https://min8852.cafe24.com/web/product/big/202601/3e8e97849a8942437a85530c1450274b.jpg", note: "min8852.cafe24.com (official CP-1 store) product_no=347: 씨피원 케라틴 인텐시브 필업 노워시 트리트먼트" },
  { code: "GVS-11251", imageUrl: "https://min8852.cafe24.com/web/product/big/202403/bc1c9dd184b3f91325bcfe3a98d8a134.jpg", note: "min8852.cafe24.com (official CP-1 store) product_no=246: CP-1 프리미엄  헤어 트리트먼트 250ml" },
  { code: "GVS-251745", imageUrl: "https://cdn.shopify.com/s/files/1/0082/1346/3093/files/7be835c49543b8c2c5dcfb4f01217211.jpg?v=1789024158", note: "doctoraltheaglobal.com: Rapid Firm Sculpting Cream" },
  { code: "GVS-251745-DEFECT", imageUrl: "https://cdn.shopify.com/s/files/1/0082/1346/3093/files/7be835c49543b8c2c5dcfb4f01217211.jpg?v=1789024158", note: "doctoraltheaglobal.com: Rapid Firm Sculpting Cream" },
  { code: "GVS-255071", imageUrl: "https://cdn.shopify.com/s/files/1/0082/1346/3093/files/b0d84708e156ebd6b42175537e2a29de.jpg?v=1789024158", note: "doctoraltheaglobal.com: Pure Grinding Cleansing Balm" },
  { code: "GVS-255620", imageUrl: "https://cdn.shopify.com/s/files/1/0082/1346/3093/files/dc6baee7be490da7e2094d401e51dd3e.jpg?v=1789024159", note: "doctoraltheaglobal.com: Pore Refresh Grinding Cleansing Balm" },
  { code: "GVS-256306", imageUrl: "https://cdn.shopify.com/s/files/1/0082/1346/3093/files/e37c2967031ac4bef912b82f0f2c6a01.jpg?v=1789024158", note: "doctoraltheaglobal.com: StretchFit Calming Pad (50pcs)" },
  { code: "GVS-255712", imageUrl: "https://cdn.shopify.com/s/files/1/0082/1346/3093/files/06bc454dfa00069de0cb8edd92b77936.jpg?v=1789024160", note: "doctoraltheaglobal.com: Cushion Veil Calming Mask (Pack of 4)" },
  { code: "GVS-255736", imageUrl: "https://cdn.shopify.com/s/files/1/0082/1346/3093/files/08799e4747285c50c00b1f98707ebea2.jpg?v=1789024159", note: "doctoraltheaglobal.com: Jelly Seal Dewy Mask (Pack of 4)" },
  { code: "GVS-255750", imageUrl: "https://cdn.shopify.com/s/files/1/0082/1346/3093/files/8afb3e595841a1052d9b8591a60946f4.jpg?v=1789024159", note: "doctoraltheaglobal.com: Aqua Blue Hydration Mask (Pack of 4)" },
  { code: "GVS-255811", imageUrl: "https://cdn.shopify.com/s/files/1/0082/1346/3093/files/fa38a96fbea3a6627f05b9d7c66a7436.jpg?v=1789024159", note: "doctoraltheaglobal.com: Vita Glow Mask (Pack of 4)" },
  { code: "GVS-256283", imageUrl: "https://cdn.shopify.com/s/files/1/0082/1346/3093/files/345_22186a85-b9b6-499a-9cc7-cba2365cfc84.jpg?v=1789024159", note: "doctoraltheaglobal.com: 345 Relief Cream Mask (Pack of 4)" },
];

async function longSide(file: string): Promise<number> {
  const meta = await sharp(file).metadata();
  return Math.max(meta.width ?? 0, meta.height ?? 0);
}

async function main() {
  let applied = 0;
  let kept = 0;
  let failed = 0;
  for (const fix of FIXES) {
    const product = await prisma.product.findUnique({ where: { code: fix.code }, include: { images: { orderBy: { sortOrder: "asc" } } } });
    if (!product) {
      console.log(`  [skip] product not found: ${fix.code}`);
      continue;
    }
    const currentUrl = product.images[0]?.url;
    const currentSide = currentUrl ? await longSide(path.join(process.cwd(), "public", currentUrl)).catch(() => 0) : 0;
    if (DRY_RUN) {
      console.log(`  ${fix.code} (${currentSide}px) <- ${fix.note}`);
      continue;
    }
    const { urls, errors } = await downloadProductImages(product.code, fix.imageUrl);
    if (urls.length === 0) {
      failed++;
      console.log(`  [error] ${fix.code}: download failed: ${errors.join("; ")}`);
      continue;
    }
    const newSide = await longSide(path.join(process.cwd(), "public", urls[0])).catch(() => 0);
    if (newSide < MIN_LONG_SIDE || newSide <= currentSide) {
      kept++;
      console.log(`  [kept old] ${fix.code}: new ${newSide}px vs current ${currentSide}px`);
      continue;
    }
    await prisma.productImage.deleteMany({ where: { productId: product.id } });
    await prisma.productImage.create({ data: { productId: product.id, url: urls[0], sortOrder: 0 } });
    applied++;
    console.log(`  ${fix.code}: ${currentSide}px -> ${newSide}px`);
  }
  console.log(`\nDone. ${applied} replaced, ${kept} kept (not better), ${failed} failed, of ${FIXES.length}.`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
