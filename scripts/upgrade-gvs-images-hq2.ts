// Second high-resolution pass over the GVS Cosmetics photos (see
// upgrade-gvs-images-hq.ts). These 15 products are no longer sold/photographed
// at high resolution by the brands' own storefronts, but Kosmos Beauty Lab (a
// K-beauty retailer on Shopify) carries them as 1080x1080 clean pack shots —
// each pair was checked side by side against our current photo. Their photos
// sit on a pale pink background (#fff7f4), so each channel is scaled by the
// measured corner colour to land on a pure white background like the rest of the
// catalog (the packaging colours shift by less than 3 %).
//
// Usage: npx tsx scripts/upgrade-gvs-images-hq2.ts --dry-run | (no flag = apply)
import { randomBytes } from "node:crypto";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { prisma } from "../src/lib/prisma";

const DRY_RUN = process.argv.includes("--dry-run");
const MIN_LONG_SIDE = 1000;

const FIXES: { code: string; imageUrl: string; note: string }[] = [
  { code: "GVS-251981", imageUrl: "https://cdn.shopify.com/s/files/1/0271/8603/6809/files/Dr._Althea_Marine_Anti-Blemish_Mask.png?v=1755333881", note: "kosmosbeauty.com (K-beauty retailer, Shopify): Dr. Althea Marine Anti-Blemish Sheet Mask" },
  { code: "GVS-253473", imageUrl: "https://cdn.shopify.com/s/files/1/0271/8603/6809/files/Dr._Althea_Skin_Relief_Essence_30ml.png?v=1755340983", note: "kosmosbeauty.com (K-beauty retailer, Shopify): Dr. Althea Skin Relief Facial Essence 30ml" },
  { code: "GVS-253480", imageUrl: "https://cdn.shopify.com/s/files/1/0271/8603/6809/files/Dr._Althea_Natural_Radiance_Antioxidant_Essence_30ml.png?v=1755341107", note: "kosmosbeauty.com (K-beauty retailer, Shopify): Dr. Althea Natural Radiance Facial Essence 30ml" },
  { code: "GVS-254395", imageUrl: "https://cdn.shopify.com/s/files/1/0271/8603/6809/files/Dr._Althea_To_Be_Youthful_Eye_Serum.png?v=1776940546", note: "kosmosbeauty.com (K-beauty retailer, Shopify): Dr. Althea To Be Youthful Eye Serum 25ml" },
  { code: "GVS-255972", imageUrl: "https://cdn.shopify.com/s/files/1/0271/8603/6809/files/Dr._Althea_Aqua_Glowing_Sunscreen_SPF50_PA_45ml.png?v=1776157394", note: "kosmosbeauty.com (K-beauty retailer, Shopify): Dr. Althea Aqua Glowing Sunscreen SPF50+ PA++++ 45ml" },
  { code: "GVS-12005", imageUrl: "https://cdn.shopify.com/s/files/1/0271/8603/6809/files/CP-1_Esthetic_House_Ginger_Purifying_Shampoo_500ml.png?v=1768566024", note: "kosmosbeauty.com (K-beauty retailer, Shopify): CP-1 Esthetic House Ginger Purifying Shampoo 500ml" },
  { code: "GVS-12012", imageUrl: "https://cdn.shopify.com/s/files/1/0271/8603/6809/products/CP-1_Esthetic_House_Ginger_Purifying_Conditioner_500ml.png?v=1768565300", note: "kosmosbeauty.com (K-beauty retailer, Shopify): CP-1 Esthetic House Ginger Purifying Conditioner 500ml" },
  { code: "GVS-12524", imageUrl: "https://cdn.shopify.com/s/files/1/0271/8603/6809/files/CP-1_Esthetic_House_3_Seconds_Hair_Fill-Up_Shampoo_500ml.png?v=1768573245", note: "kosmosbeauty.com (K-beauty retailer, Shopify): CP-1 Esthetic House 3 Seconds Hair Fill-Up Shampoo 500ml" },
  { code: "GVS-10179", imageUrl: "https://cdn.shopify.com/s/files/1/0271/8603/6809/products/CP-1_Esthetic_House_Raspberry_Treatment_Vinegar_500ml.png?v=1757072394", note: "kosmosbeauty.com (K-beauty retailer, Shopify): CP-1 Esthetic House Raspberry Treatment Vinegar 500ml" },
  { code: "GVS-10230", imageUrl: "https://cdn.shopify.com/s/files/1/0271/8603/6809/files/CP-1_Esthetic_House_Keratin_Concentrate_Ampoule_80ml.png?v=1768571935", note: "kosmosbeauty.com (K-beauty retailer, Shopify): CP-1 Esthetic House Keratin Concentrate Ampoule 80ml" },
  { code: "GVS-11022", imageUrl: "https://cdn.shopify.com/s/files/1/0271/8603/6809/files/CP-1_Esthetic_House_Premium_Silk_Ampoule_150ml.png?v=1757503152", note: "kosmosbeauty.com (K-beauty retailer, Shopify): CP-1 Esthetic House Premium Silk Ampoule 150ml" },
  { code: "GVS-11848", imageUrl: "https://cdn.shopify.com/s/files/1/0271/8603/6809/files/CP-1_Esthetic_House_3_Seconds_Hair_Fill-up_Ampoule_170ml.png?v=1768570497", note: "kosmosbeauty.com (K-beauty retailer, Shopify): CP-1 Esthetic House 3 Seconds Hair Fill-up Ampoule 170ml" },
  { code: "GVS-12081", imageUrl: "https://cdn.shopify.com/s/files/1/0271/8603/6809/files/CP-1_Esthetic_House_Bright_Complex_Intense_Nourishing_Shampoo_500ml.png?v=1768562703", note: "kosmosbeauty.com (K-beauty retailer, Shopify): CP-1 Esthetic House Bright Complex Intense Nourishing Shampoo 500ml" },
  { code: "GVS-12098", imageUrl: "https://cdn.shopify.com/s/files/1/0271/8603/6809/files/CP-1_Esthetic_House_Bright_Complex_Intense_Nourishing_Conditioner_500ml.png?v=1768560146", note: "kosmosbeauty.com (K-beauty retailer, Shopify): CP-1 Esthetic House Bright Complex Intense Nourishing Conditioner 500ml" },
  { code: "GVS-12111", imageUrl: "https://cdn.shopify.com/s/files/1/0271/8603/6809/files/CP-1_Esthetic_House_Bright_Complex_Intense_Nourishing_Conditioner_100ml.png?v=1768561026", note: "kosmosbeauty.com (K-beauty retailer, Shopify): CP-1 Esthetic House Bright Complex Intense Nourishing Conditioner 100ml" },
];

/** Median colour of the four 30x30 corners = the photo's flat background. */
async function cornerBackground(buf: Buffer): Promise<[number, number, number]> {
  const { data, info } = await sharp(buf).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width, height } = info;
  const samples: number[][] = [[], [], []];
  for (const [x0, y0] of [[0, 0], [width - 30, 0], [0, height - 30], [width - 30, height - 30]]) {
    for (let y = y0; y < y0 + 30; y += 3) {
      for (let x = x0; x < x0 + 30; x += 3) {
        const i = (y * width + x) * 3;
        for (let c = 0; c < 3; c++) samples[c].push(data[i + c]);
      }
    }
  }
  const median = (a: number[]) => a.sort((p, q) => p - q)[Math.floor(a.length / 2)];
  return [median(samples[0]), median(samples[1]), median(samples[2])];
}

async function main() {
  let applied = 0;
  for (const fix of FIXES) {
    const product = await prisma.product.findUnique({ where: { code: fix.code }, include: { images: true } });
    if (!product) {
      console.log(`  [skip] product not found: ${fix.code}`);
      continue;
    }
    if (DRY_RUN) {
      console.log(`  ${fix.code} <- ${fix.note}`);
      continue;
    }
    const res = await fetch(fix.imageUrl, { signal: AbortSignal.timeout(30_000) });
    if (!res.ok) {
      console.log(`  [error] ${fix.code}: HTTP ${res.status}`);
      continue;
    }
    const buf = Buffer.from(await res.arrayBuffer());
    const meta = await sharp(buf).metadata();
    const side = Math.max(meta.width ?? 0, meta.height ?? 0);
    if (side < MIN_LONG_SIDE) {
      console.log(`  [kept old] ${fix.code}: source only ${side}px`);
      continue;
    }
    const [r, g, b] = await cornerBackground(buf);
    const out = await sharp(buf)
      .removeAlpha()
      .linear([255 / Math.max(r, 1), 255 / Math.max(g, 1), 255 / Math.max(b, 1)], [0, 0, 0])
      .jpeg({ quality: 95, chromaSubsampling: "4:4:4" })
      .toBuffer();
    const dir = path.join(process.cwd(), "public", "uploads", "products", encodeURIComponent(product.code));
    await mkdir(dir, { recursive: true });
    const name = `${randomBytes(6).toString("hex")}-0.jpg`;
    await sharp(out).toFile(path.join(dir, name));
    const url = `/uploads/products/${encodeURIComponent(product.code)}/${name}`;
    await prisma.productImage.deleteMany({ where: { productId: product.id } });
    await prisma.productImage.create({ data: { productId: product.id, url, sortOrder: 0 } });
    applied++;
    console.log(`  ${fix.code}: ${side}px, background (${r},${g},${b}) -> white`);
  }
  console.log(`\nDone. ${applied}/${FIXES.length} applied.`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
