// Same rule-based cosmetics filters as backfill-cosmetics-filters.ts, for the mainstream (drugstore) skincare under Kosmetika > Pleť
// (Nivea, Kamill, Aknelot, Palacio…) that the K-beauty backfill never covered: only 126 of 760 had a product type. Czech names, so a
// subcategory fallback sets the type when no keyword matches. Never overwrites existing values (type/ingredients only filled when empty).
//   npx tsx --env-file=.env scripts/backfill-skincare-filters.ts            dry run
//   npx tsx --env-file=.env scripts/backfill-skincare-filters.ts --apply
// ORIGINAL HEADER:
//   Product.productType     "Druh produktu"
//   Product.keyIngredients  "Složka"
//   ProductConcern          "Účel"      (existing taxonomy)  — only ADDS tags, never removes manual ones
//   ProductSkinType         "Typ pleti" (existing taxonomy)  — only ADDS tags; deliberately conservative (clear cues only)
// Idempotent. Scope is the "Korejská kosmetika" category for now.
//   npx tsx scripts/backfill-cosmetics-filters.ts            dry run
//   npx tsx scripts/backfill-cosmetics-filters.ts --apply
import { PrismaClient } from "@prisma/client";
import { writeFileSync } from "fs";

const prisma = new PrismaClient();
const APPLY = process.argv.includes("--apply");

export const PRODUCT_TYPES: [string, RegExp][] = [
  ["sady", /\bkit\b|\bset\b|sada\b|sachet|sponge|houbičk|spot powder|lokální péče/i],
  ["vlasy", /shampoo|šampon|conditioner|kondicion|\bhair\b|vlasov|vlasy|\bvlas|scalp|pokožk[ay] hlavy|treatment vinegar|keratin|\bcp-1\b/i],
  ["slunce", /sunscreen|sun cream|sun serum|sun essence|relief sun|opalovac|uv shield|\bspf\b/i],
  ["makeup", /bb cream|\bbb krém|primer|powder|pudr|báze pod/i],
  ["oci", /eye (cream|serum|roller|tox)|oční|eye gel/i],
  ["peeling", /exfoli|peeling|power liquid|zero pore pad|scaler|glycolic aha|aha·bha·pha toner/i],
  ["cisteni", /cleans|cleanser|čisticí|čistící|odličov|micelár|foam|konjac|bubble/i],
  ["masky", /mask|maska|sleeping pack|\bpatch\b|náplast|sheet|glaze|wrapping/i],
  ["tonika", /toner|tonik|essence|esence|mist|mlha|sprej|\bpad\b|polštář|essence water|esenciální/i],
  ["sera", /serum|sérum|ampoule|ampule|booster|reedle|shot|\boil\b|olej|elixir/i],
  ["kremy", /cream|krém|lotion|mléko|emulsion|moistur|gel cream|\bgel\b|balm|balzám/i],
];
export const INGREDIENTS: [string, string, RegExp][] = [
  ["centella", "Centella asijská", /centella|\bcica\b|cica-|madecassoside/i],
  ["propolis", "Propolis", /propolis/i],
  ["niacinamid", "Niacinamid", /niacinamid/i],
  ["retinol", "Retinol a retinoidy", /retinol|retinal|bakuchiol|reti-a/i],
  ["hyaluron", "Kyselina hyaluronová", /hyalu/i],
  ["peptidy", "Peptidy", /peptid/i],
  ["hlemyzdi", "Hlemýždí mucin", /snail|hlemýž|hlemyz/i],
  ["zensen", "Ženšen", /ginseng|ženšen|zensen/i],
  ["ryze", "Rýže", /\brice\b|rýž|ryze/i],
  ["zeleny-caj", "Zelený čaj", /green tea|zelený čaj|zeleným čajem/i],
  ["vitamin-c", "Vitamin C", /vitamin c|vitamín c|vit[a-z]*-light|vita glow|ascorb/i],
  ["pdrn", "PDRN", /pdrn/i],
  ["kyseliny", "AHA / BHA kyseliny", /\baha\b|\bbha\b|\bpha\b|salicyl|glycolic|glykol|kyselin[a-z]* (salicyl|glykol|mléčn)/i],
  ["kolagen", "Kolagen", /collagen|kolagen/i],
  ["ceramidy", "Ceramidy", /ceramid|cera-nol|\bcera\b/i],
  ["aloe", "Aloe vera", /\baloe\b/i],
];

// Účel → existing Concern slugs
const CONCERNS: [string, RegExp][] = [
  ["hydratace", /hydrat|moist|hyalu|\baqua\b|ceramid|watery|water gel|barrier|zvlhč|vlhk/i],
  ["akne", /acne|akn[eé]|blackhead|\bpore|póry|salicyl|\bbha\b|tea tree|čajovn|blemish|pimple|sebum|spot powder|nečistot/i],
  ["vrasky-starnuti", /retinol|retinal|peptid|collagen|kolagen|lifting|firming|zpevň|wrinkle|vrásk|anti-?age|\btox\b|elasticity|bakuchiol|sculpting|pdrn|stárnut/i],
  ["pigmentace", /arbutin|kojic|kojov|dark spot|pigment|glutathion|discoloration|tmavé skvrn|whitehead/i],
  ["zarudnuti-citlivost", /centella|\bcica\b|cica-|calming|soothing|zklidň|relief|panthenol|heart ?leaf|\baloe\b|sensitive|citliv|redness|zarudn|barrier|mugwort|podráždě/i],
  ["rozjasneni", /niacinamid|vitamin c|\bglow\b|bright|rozjasň|radiance|vita-|vita glow|glutathion|arbutin/i],
  ["cisteni-detox", /cleans|čisticí|čistící|odličov|detox|\bmud\b|jíl|exfoli|peeling|pore pad|scaler|clarifying|purifying/i],
];
// Typ pleti — only strong cues (conservative on purpose)
const SKIN: [string, RegExp][] = [
  ["citliva", /centella|\bcica\b|cica-|calming|soothing|zklidň|sensitive|citliv|relief|panthenol|heart ?leaf|\baloe\b|mugwort|barrier/i],
  ["mastna", /acne|akn[eé]|oil.?free|\bpore|póry|blackhead|\bbha\b|salicyl|sebum|tea tree|poremizing|mastn/i],
  ["sucha", /nutrition|nourish|vyživ|rich|barrier|ceramid|overnight|sleeping|suchou|suchá|dry skin|intensive moist/i],
];

const strip = (html: string | null) => (html ?? "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").toLowerCase();

function classify(name: string, description: string | null) {
  const n = name.toLowerCase();
  const text = `${n} ${strip(description)}`;
  const type = PRODUCT_TYPES.find(([, re]) => re.test(n))?.[0] ?? null;
  const ingredients = INGREDIENTS.filter(([, , re]) => re.test(text)).map(([slug]) => slug);
  const isHair = type === "vlasy";
  const concerns = isHair ? [] : CONCERNS.filter(([, re]) => re.test(text)).map(([slug]) => slug);
  const skin = isHair ? [] : SKIN.filter(([, re]) => re.test(text)).map(([slug]) => slug);
  return { type, ingredients, concerns, skin };
}


const SUB_TYPE: Record<string, string> = {
  "Čištění pleti": "cisteni",
  "Pleťová séra": "sera",
  "Pleťové krémy": "kremy",
  "Pleťové peelingy": "peeling",
  "Pleťové masky": "masky",
};

async function main() {
  const subs = await prisma.category.findMany({ where: { name: { in: Object.keys(SUB_TYPE) }, parent: { name: "Pleť" } }, select: { id: true, name: true } });
  const subName = new Map(subs.map((c) => [c.id, c.name]));
  const ps = await prisma.product.findMany({
    where: { visible: true, categories: { some: { categoryId: { in: subs.map((c) => c.id) } } } },
    select: { id: true, name: true, description: true, productType: true, keyIngredients: true, categories: { select: { categoryId: true } } },
  });
  const typeCount = new Map<string, number>(), ingCount = new Map<string, number>(), concCount = new Map<string, number>(), skinCount = new Map<string, number>();
  const plans = ps.map((p) => {
    const c = classify(p.name, p.description);
    const sub = p.categories.map((x) => subName.get(x.categoryId)).find(Boolean);
    const type = p.productType ?? c.type ?? (sub ? SUB_TYPE[sub] : null);
    const ingredients = p.keyIngredients.length ? p.keyIngredients : c.ingredients;
    typeCount.set(type ?? "(none)", (typeCount.get(type ?? "(none)") ?? 0) + 1);
    c.ingredients.forEach((i) => ingCount.set(i, (ingCount.get(i) ?? 0) + 1));
    c.concerns.forEach((i) => concCount.set(i, (concCount.get(i) ?? 0) + 1));
    c.skin.forEach((i) => skinCount.set(i, (skinCount.get(i) ?? 0) + 1));
    return { id: p.id, type, ingredients, concerns: c.concerns, skin: c.skin, changesType: !p.productType && !!type };
  });
  const fmt = (m: Map<string, number>) => [...m.entries()].sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${v}`).join(", ");
  console.log(`Pleť products: ${ps.length}; type newly set: ${plans.filter((p) => p.changesType).length}`);
  console.log("type:", fmt(typeCount)); console.log("ingredients:", fmt(ingCount)); console.log("concerns:", fmt(concCount)); console.log("skin:", fmt(skinCount));
  if (!APPLY) return console.log("DRY RUN");
  // Before-state for rollback (tags are additive; productType/keyIngredients are restorable from this file).
  const before = await prisma.product.findMany({
    where: { id: { in: plans.map((p) => p.id) } },
    select: { id: true, productType: true, keyIngredients: true, concerns: { select: { concernId: true } }, skinTypes: { select: { skinTypeId: true } } },
  });
  writeFileSync(`ops/snapshots/skincare-filters-before-${Date.now()}.json`, JSON.stringify(before));
  const concernRows = await prisma.concern.findMany(), skinRows = await prisma.skinType.findMany();
  const cid = new Map(concernRows.map((c) => [c.slug, c.id])), sid = new Map(skinRows.map((c) => [c.slug, c.id]));
  for (const p of plans) {
    await prisma.product.update({ where: { id: p.id }, data: { productType: p.type, keyIngredients: p.ingredients } });
    const cdata = p.concerns.map((s) => cid.get(s)).filter(Boolean).map((concernId) => ({ productId: p.id, concernId: concernId! }));
    if (cdata.length) await prisma.productConcern.createMany({ data: cdata, skipDuplicates: true });
    const sdata = p.skin.map((s) => sid.get(s)).filter(Boolean).map((skinTypeId) => ({ productId: p.id, skinTypeId: skinTypeId! }));
    if (sdata.length) await prisma.productSkinType.createMany({ data: sdata, skipDuplicates: true });
  }
  console.log("APPLIED", plans.length);
}
main().finally(() => prisma.$disconnect());
