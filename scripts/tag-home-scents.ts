/**
 * Rule-based "Charakter vůně" tags for scented home products (air fresheners, car fresheners, diffusers, candles),
 * mined from the product name (they carry the scent in English or Czech: "Ocean Breeze", "Lavender", "Vanilla").
 * Reuses the perfume ScentFamily facet so the filter appears on those categories without new UI.
 * Usage: npx tsx --env-file=.env scripts/tag-home-scents.ts [--apply]
 */
import { writeFileSync } from "fs";
import { prisma } from "../src/lib/prisma";

const RULES: Record<string, RegExp> = {
  "svezi-vodni": /\b(ocean|ocean|aqua|breeze|linen|cotton|bavln|rain|dew|wave|marine|sea\b|more|mountain|alaska|polar|glacier|arctic|ice\b|cool|spring|clean|laundry|vypran|pradl|wind|sport|water|blue|fresh cotton|cold)/,
  citrusova: /\b(lemon|citron|citrus|lime|limet|orange|pomeran|grapefruit|bergamot|yuzu|mandarin|tangerine|lemongrass)/,
  kvetinova: /\b(flower|floral|kvet|bouquet|blossom|jasmin|rose\b|roses|roze|ruz|louk|meadow|lilac|seri[kc]|magnoli|lily|lilie|gardenia|tuberose|peony|pivon|orchid|freesia|violet|fialk|tulip|bloom)/,
  "sladka-gurmanska": /\b(vanil|caramel|karamel|chocolate|cokol|cafe|coffee|kava|latte|cherry|tresn|strawberr|jahod|raspberr|malin|peach|broskev|mango|melon|apple|jablk|honey|coconut|kokos|cupcake|cookie|candy|sweet|dessert|pistach|banan|pineapple|ananas|berry|fruit|macaron|cream|tropical|hawaii)/,
  "zelena-bylinna": /\b(lavend|levand|mint|mata|eucalypt|green tea|zeleny caj|bamboo|bambus|cucumber|okurk|herb|bylin|sage|salvej|rosemary|rozmaryn|eukalypt|aloe|tea tree|basil|thyme|grass|garden|zahrad)/,
  "orientalni-korenita": /\b(oriental|orient|cinnamon|cinamon|skoric|spice|koren|pepper|pepr|amber|oud|incense|kadidlo|sandal|patchouli|pumpkin|dyne|ginger|zazvor|clove|hrebicek|ayurveda|indian|arab|mystic|exotic)/,
  drevita: /\b(wood\b|drev|pine|borovi|cedar|cedr|sandalwood|forest|oak\b|dub\b|junglewood|soakedwood|tree\b|sequoia|spruce|smrk)/,
  pizmova: /\b(musk|pizm)/,
  "kozena-koureova": /\b(leather|kuze|smoke|kour)/,
};
const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

async function main() {
  const apply = process.argv.includes("--apply");
  const families = await prisma.scentFamily.findMany({ select: { id: true, slug: true } });
  const idBySlug = new Map(families.map((f) => [f.slug, f.id]));
  const products = await prisma.product.findMany({
    where: {
      visible: true,
      categories: { some: { category: { OR: [{ name: { in: ["Osvěžovače vzduchu", "Aroma Difuzéry", "Vonné svíčky", "Vůně do auta", "Domácnost"] } }, { parent: { name: { in: ["Osvěžovače vzduchu", "Domácnost"] } } }] } } },
    },
    select: { id: true, name: true, scentFamilies: { select: { scentFamilyId: true } }, categories: { select: { category: { select: { name: true } } } } },
  });
  const rows: { productId: string; scentFamilyId: string }[] = [];
  let tagged = 0; const unmatched: string[] = []; const perFamily: Record<string, number> = {};
  for (const p of products) {
    const n = norm(p.name).replace(/anti tobacco/g, "");
    const hit = Object.entries(RULES).filter(([, re]) => re.test(n)).map(([slug]) => slug);
    if (hit.length === 0) { unmatched.push(p.name); continue; }
    tagged++;
    for (const slug of hit) {
      perFamily[slug] = (perFamily[slug] ?? 0) + 1;
      const fid = idBySlug.get(slug);
      if (fid && !p.scentFamilies.some((s) => s.scentFamilyId === fid)) rows.push({ productId: p.id, scentFamilyId: fid });
    }
  }
  console.log(`products in scope ${products.length}, tagged ${tagged} (${Math.round((tagged / products.length) * 100)}%), new tag rows ${rows.length}`);
  console.log("per family:", JSON.stringify(perFamily));
  console.log("sample unmatched:", unmatched.slice(0, 25).join(" | "));
  if (!apply) return;
  const res = await prisma.productScentFamily.createMany({ data: rows, skipDuplicates: true });
  writeFileSync(`ops/snapshots/home-scents-${Date.now()}.json`, JSON.stringify(rows));
  console.log("created", res.count);
}
main().then(() => process.exit(0));
