// Second high-resolution pass over the GVS Cosmetics photos (see
// upgrade-gvs-images-hq.ts). These 15 products are no longer sold/photographed
// at high resolution by the brands' own storefronts, but Kosmos Beauty Lab (a
// K-beauty retailer on Shopify) carries them as 1080x1080 clean pack shots —
// each pair was checked side by side against our current photo. Their photos
// sit on a pale pink background (#fff7f4), so each channel is scaled by the
// measured corner colour to land on a pure white background like the rest of the
// catalog (the packaging colours shift by less than 3 %).
//
// A fix may carry a `crop` (applied after the background is measured on the full image).
//
// Usage: npx tsx scripts/upgrade-gvs-images-hq2.ts --dry-run | (no flag = apply)
import { randomBytes } from "node:crypto";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { prisma } from "../src/lib/prisma";

const DRY_RUN = process.argv.includes("--dry-run");
const FORCE = process.argv.includes("--force");
const ONLY = process.argv.find((a) => a.startsWith("--only="))?.slice(7).split(",");
const MIN_LONG_SIDE = 1000;

const FIXES: { code: string; imageUrl: string; crop?: { left: number; top: number; width: number; height: number }; trimPad?: boolean; minSide?: number; note: string }[] = [
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
  // --- third batch: Free Moment (FREEMOMENT) products, from Shopify retailers. The two shampoos only exist
  // as one two-variant image (2048 px, itself an upscale of ~1000 px), so each flavour is cropped out of it.
  { code: "GVS-254968", imageUrl: "https://cdn.shopify.com/s/files/1/1323/4713/files/Free-Moment-Refresh-Moment-Perfume-Treatment-01-JEJU-CAMELLIA-Nudie-Glow-Australia.jpg?v=1749618136", crop: undefined, note: "nudieglow.com: Refresh Moment Perfume Treatment 01 Jeju Camellia (1024)" },
  { code: "GVS-254975", imageUrl: "https://cdn.shopify.com/s/files/1/1323/4713/files/Free-Moment-Refresh-Moment-Perfume-Treatment-_02-FIG-FOG-Nudie-Glow-Australia.jpg?v=1749618371", crop: undefined, note: "nudieglow.com: Refresh Moment Perfume Treatment 02 Fig Fog (1024)" },
  { code: "GVS-254944", imageUrl: "https://cdn.shopify.com/s/files/1/0031/7610/4006/files/Free_Moment_Refresh_Moment_Perfume_Shampoo.png?v=1786987157", crop: { left: 36, top: 740, width: 1020, height: 982 }, note: "olivekollection.com: Refresh Moment Perfume Shampoo, 01 Jeju Camellia half of the 2048 two-variant shot" },
  { code: "GVS-254951", imageUrl: "https://cdn.shopify.com/s/files/1/0031/7610/4006/files/Free_Moment_Refresh_Moment_Perfume_Shampoo.png?v=1786987157", crop: { left: 1008, top: 740, width: 1020, height: 982 }, note: "olivekollection.com: Refresh Moment Perfume Shampoo, 02 Fig Fog half of the 2048 two-variant shot" },
  { code: "GVS-254494", imageUrl: "https://cdn.shopify.com/s/files/1/0806/6102/1007/files/FREEMOMENTGreenCalmingSerumMist_100ml.jpg?v=1751974078", crop: undefined, note: "saranghae.ch: Free Moment Green Calming Serum Mist 100ml (1080)" },
  // --- fourth batch
  // Polatam Power Ampoule: cosmeterie.com serves a transparent 1024x2666 PNG of the bottle itself; trimmed and
  // centred on a white square (the bottle stays ~1000 px wide, i.e. no upscaling).
  { code: "GVS-3005106", imageUrl: "https://co.nice-cdn.com/upload/image/product/large/default/84219_76acf49e.png", trimPad: true, note: "cosmeterie.com: POLATAM Cica Malacalming Power Ampoule (transparent PNG 1024x2666, trimmed)" },
  // VVBETTER Konjac Sponge: the best photo found anywhere is 880x880 (moyo.ua), better than our 730 but under the 1000 px target.
  { code: "GVS-2555218", imageUrl: "https://i.moyo.ua/img/products/6656/76_4000.jpg?1757581965", minSide: 800, note: "moyo.ua: VVBETTER Konjac Sponge (880x880 - best available)" },
  { code: "GVS-255033", imageUrl: "https://cdn.shopify.com/s/files/1/0806/6102/1007/files/Dr.Althea-15_CalamineSpotPowder_15ml.webp?v=1732708658", note: "saranghae.ch: Dr. Althea 15% Calamine Spot Powder 15ml (1024)" },
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
    if (ONLY && !ONLY.includes(fix.code)) continue;
    const product = await prisma.product.findUnique({ where: { code: fix.code }, include: { images: true } });
    if (!product) {
      console.log(`  [skip] product not found: ${fix.code}`);
      continue;
    }
    if (DRY_RUN) {
      console.log(`  ${fix.code} <- ${fix.note}`);
      continue;
    }
    // Idempotent re-runs: leave products whose current photo is already high-res.
    const currentUrl = product.images[0]?.url;
    const currentSide = currentUrl ? (await sharp(path.join(process.cwd(), "public", currentUrl)).metadata().catch(() => null))?.width ?? 0 : 0;
    if (currentSide >= (fix.minSide ?? MIN_LONG_SIDE) && !FORCE) {
      console.log(`  [skip] ${fix.code}: already ${currentSide}px`);
      continue;
    }
    const res = await fetch(fix.imageUrl, { signal: AbortSignal.timeout(30_000) });
    if (!res.ok) {
      console.log(`  [error] ${fix.code}: HTTP ${res.status}`);
      continue;
    }
    const buf = Buffer.from(await res.arrayBuffer());
    const meta = await sharp(buf).metadata();
    const side = fix.crop ? Math.max(fix.crop.width, fix.crop.height) : Math.max(meta.width ?? 0, meta.height ?? 0);
    const minSide = fix.minSide ?? MIN_LONG_SIDE;
    if (side < minSide) {
      console.log(`  [kept old] ${fix.code}: source only ${side}px`);
      continue;
    }
    let out: Buffer;
    let note = "";
    if (fix.trimPad) {
      const trimmed = await sharp(buf).trim().flatten({ background: "#ffffff" }).toBuffer({ resolveWithObject: true });
      const edge = Math.round(Math.max(trimmed.info.width, trimmed.info.height) * 1.1);
      // Two steps on purpose: sharp always runs resize BEFORE extend inside one pipeline.
      const squared = await sharp(trimmed.data)
        .extend({
          top: Math.floor((edge - trimmed.info.height) / 2),
          bottom: Math.ceil((edge - trimmed.info.height) / 2),
          left: Math.floor((edge - trimmed.info.width) / 2),
          right: Math.ceil((edge - trimmed.info.width) / 2),
          background: "#ffffff",
        })
        .png()
        .toBuffer();
      out = await sharp(squared)
        .resize(1800, 1800, { fit: "inside", withoutEnlargement: true }) // keep the file sensible; still ~1.7x the 1000 px target
        .jpeg({ quality: 95, chromaSubsampling: "4:4:4" })
        .toBuffer();
      note = `trimmed + centred on a white square (${edge}px, capped at 1800)`;
    } else {
      const [r, g, b] = await cornerBackground(buf);
      out = await sharp(buf)
        .removeAlpha()
        .extract(fix.crop ?? { left: 0, top: 0, width: meta.width ?? 0, height: meta.height ?? 0 })
        .linear([255 / Math.max(r, 1), 255 / Math.max(g, 1), 255 / Math.max(b, 1)], [0, 0, 0])
        .jpeg({ quality: 95, chromaSubsampling: "4:4:4" })
        .toBuffer();
      note = `background (${r},${g},${b}) -> white`;
    }
    const dir = path.join(process.cwd(), "public", "uploads", "products", encodeURIComponent(product.code));
    await mkdir(dir, { recursive: true });
    const name = `${randomBytes(6).toString("hex")}-0.jpg`;
    await sharp(out).toFile(path.join(dir, name));
    const url = `/uploads/products/${encodeURIComponent(product.code)}/${name}`;
    await prisma.productImage.deleteMany({ where: { productId: product.id } });
    await prisma.productImage.create({ data: { productId: product.id, url, sortOrder: 0 } });
    applied++;
    console.log(`  ${fix.code}: ${side}px, ${note}`);
  }
  console.log(`\nDone. ${applied}/${FIXES.length} applied.`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
