// One-off (partially re-runnable) cleanup: the legacy Shoptet catalog and
// SP Venture import both had category-mapping gaps that left ~808 products
// (12% of the catalog) attached only to a bare PARENT category (e.g. "zuby",
// "kosmetika/telo", "parfemy") instead of a specific leaf subcategory. With
// this many SKUs, a product with no specific subcategory is effectively
// unfindable — user's explicit standing rule: every product must sit in a
// real leaf category, even if that means creating a new one for a genuine
// gap, rather than leaving it at a bare parent.
//
// Usage:
//   npx tsx scripts/fix-parent-only-categories.ts            (dry run, prints only)
//   npx tsx scripts/fix-parent-only-categories.ts --apply    (writes)
import { prisma } from "../src/lib/prisma";

async function ensureCategory(cache: Map<string, string>, fullSlug: string, newLeafName?: string): Promise<string> {
  if (cache.has(fullSlug)) return cache.get(fullSlug)!;
  let cat = await prisma.category.findUnique({ where: { fullSlug } });
  if (!cat && newLeafName) {
    const parentSlug = fullSlug.split("/").slice(0, -1).join("/");
    const parent = await prisma.category.findUnique({ where: { fullSlug: parentSlug } });
    if (!parent) throw new Error(`missing parent ${parentSlug} for new leaf ${fullSlug}`);
    const childSlug = fullSlug.split("/").pop()!;
    cat = await prisma.category.create({ data: { name: newLeafName, slug: childSlug, fullSlug, parentId: parent.id } });
    console.log(`Created new category: ${fullSlug} (${newLeafName})`);
  }
  if (!cat) throw new Error(`missing category ${fullSlug}`);
  cache.set(fullSlug, cat.id);
  return cat.id;
}

// ---------------------------------------------------------------------------
// zuby (dental) — mostly dental items that landed at the bare parent because
// SP Venture's/legacy feed didn't carry a subcategory.
function classifyZuby(n: string): { fullSlug?: string } {
  const l = n.toLowerCase();
  if (/ústní voda|ustní voda|mouthwash/.test(l)) return { fullSlug: "zuby/ustni-vody" };
  if (/dentální nit|zubní nit/.test(l)) return { fullSlug: "zuby/zubni-nite" };
  if (/pasta/.test(l)) return { fullSlug: "zuby/zubni-pasty" };
  if (/kartáček/.test(l)) return { fullSlug: "zuby/zubni-kartacky" };
  return { fullSlug: "zuby/doplnky-k-cisteni-zubu" }; // interdental brushes, toothpicks, tongue cleaner, dental-prosthesis cream, combo "Sada"
}

// ---------------------------------------------------------------------------
// kosmetika/telo — dental items misfiled here (SP Venture's generic BODY
// fallback), plus real body-care items needing a proper subcategory.
function classifyTelo(n: string): { fullSlug?: string; newLeaf?: string } {
  const l = n.toLowerCase();
  if (/ústní voda|ustní voda|mouthwash|mouth spray|mouth wash|ústní dezodor/.test(l)) return { fullSlug: "zuby/ustni-vody" };
  if (/dental floss|floss action/.test(l)) return { fullSlug: "zuby/zubni-nite" };
  if (/toothpaste|zubní pasta|zubní gel|tooth mousse|^sensodyne|^parodontax/.test(l)) return { fullSlug: "zuby/zubni-pasty" };
  if (/mezizubní kartáč|interdental brush/.test(l)) return { fullSlug: "zuby/doplnky-k-cisteni-zubu" };
  if (/toothbrush|zubní kartáč|^oral-b pro/.test(l)) return { fullSlug: "zuby/zubni-kartacky" };
  if (/fixační krém|dental prosthes|artificial teeth cleaner|svěží extra silný|corega/.test(l)) return { fullSlug: "zuby/doplnky-k-cisteni-zubu" };
  if (/pouzdro na zubní kartáček/.test(l)) return { fullSlug: "zuby/doplnky-k-cisteni-zubu" };

  if (/\bset\b|\bset\(/.test(l)) return { fullSlug: "kosmetika/telo/darkove-sady", newLeaf: "Dárkové sady" };
  if (/shower gel|sprchový gel|shower gel-mousse|bath & shower gel|all-over shower gel|shower & shampoo|sprchový olej|shower oil|shower cream/.test(l)) return { fullSlug: "kosmetika/sprchove-gely" };
  if (/\bsoap\b|mýdlo/.test(l)) return { fullSlug: "kosmetika/telo/mydla" };
  if (/body scrub|scrub|peeling|massage gel|massage cream|massage oil|anti-cellulite|talasso-scrub|francovka|\boil with pump\b/.test(l)) return { fullSlug: "kosmetika/telo/peelingy-a-masaze", newLeaf: "Peelingy a masáže" };
  if (/body lotion|\blotion\b|tělové mléko|body butter|hydrating cleanser|body wash|hands & body wash|hand and body wash|hand & body wash/.test(l)) return { fullSlug: "kosmetika/telo/telova-mleka" };
  if (/beard oil|beard wash|beard balm|beard conditioner|beard shampoo|olej na vousy/.test(l)) return { fullSlug: "kosmetika/telo/depilace" };
  if (/body spray|body splash|perfumed spray|tělová voda|hair & body mist|body mist/.test(l)) return { fullSlug: "kosmetika/telo/telove-spreje", newLeaf: "Tělové spreje" };
  if (/bath bomb|koupelová sůl|bath salt|bath foam/.test(l)) return { fullSlug: "kosmetika/telo/sprcha-a-koupel" };
  if (/cleansing|gel moussant|wash cream|cleanser|syndet|foaming gel|foaming oil|cicabio|face body & hair gel|3in1/.test(l)) return { fullSlug: "kosmetika/telo/sprcha-a-koupel" };
  if (/insole|vložky do bot|roller head|dezinfekce|baby powder|1st change cream|decolletage cream|ointment/.test(l)) return { fullSlug: "kosmetika/telo/doplnky", newLeaf: "Doplňky" };
  if (/rehabilitating cream|arthrosan|cannabis balm|mct kokosový olej/.test(l)) return { fullSlug: "pece-o-zdravi/ostatni", newLeaf: "Ostatní" };
  if (/menstr\.kalhotky/.test(l)) return { fullSlug: "pece-o-zdravi/ostatni", newLeaf: "Ostatní" };
  return {};
}

// ---------------------------------------------------------------------------
// parfemy / parfemy/{damske,panske,unisex}-parfemy — gender + concentration
// inference for perfumes lacking a leaf, plus a real "Doplňky" (Travalo
// atomizers etc.) and gift-set bucket that this tree never had.
function detectGender(name: string): "panske" | "damske" | "unisex" | null {
  if (/\(woman\)|for women|pro ženy|pour femme|\bfemme\b|\blady\b|\bW\b/i.test(name)) return "damske";
  if (/\(man\)|for men|pro muže|pour homme|\bhomme\b|\bM\b/i.test(name)) return "panske";
  if (/\(unisex\)|\bunisex\b|\bU\b/i.test(name)) return "unisex";
  return null;
}

function detectConcentration(name: string): "parfemovane-oleje" | "parfemovane-vody" | "toaletni-vody" {
  const n = name.toLowerCase();
  if (/\bcpo\b|concentrated perfum(ed)? oil|parfémový olej|perfumed oil/.test(n)) return "parfemovane-oleje";
  if (/\bedp\b|eau de parfum|parfémová voda|\bparfum\b/.test(n)) return "parfemovane-vody";
  return "toaletni-vody";
}

function classifyParfemy(name: string, fixedGender?: "panske" | "damske" | "unisex"): { fullSlug?: string; newLeaf?: string } {
  const n = name.toLowerCase();
  if (/travalo|rozprašovač parfém|refillable (perfume )?(sprayer|atomiser|atomizer)|refillable atomiser/.test(n)) {
    return { fullSlug: "parfemy/doplnky", newLeaf: "Doplňky" };
  }
  if (/scentplug|electric socket diffuser|yankee candle/.test(n)) return { fullSlug: "aroma-difuzery" };
  if (/\bset\b|dárková sada|gift set/.test(n)) return { fullSlug: "parfemy/darkove-sady" };

  // No gender token anywhere — safer to place as unisex than guess wrong,
  // but it still needs a real leaf rather than sitting at bare "parfemy".
  const gender = fixedGender ?? detectGender(name) ?? "unisex";
  const concentration = detectConcentration(name);
  const genderSlug = `${gender}-parfemy`;
  if (concentration === "parfemovane-oleje") {
    return { fullSlug: `parfemy/${genderSlug}/parfemovane-oleje`, newLeaf: "Parfémované oleje" };
  }
  return { fullSlug: `parfemy/${genderSlug}/${concentration}` };
}

// ---------------------------------------------------------------------------
// kosmetika/dekorativni-kosmetika — this bucket was overwhelmingly face
// makeup (foundation, powder, concealer, BB/CC cream) with no "Tvář" leaf.
function classifyDekorativni(n: string): { fullSlug?: string; newLeaf?: string } {
  const l = n.toLowerCase();
  if (/eyeshadow brush|mascara|eyeliner|eye pencil/.test(l)) return { fullSlug: "kosmetika/dekorativni-kosmetika/oci" };
  if (/\blip\b|lipstick|lip liner|lip gloss/.test(l)) return { fullSlug: "kosmetika/dekorativni-kosmetika/rty" };
  if (/brush case|pouzdro na štětce|ochranné pásky/.test(l)) return { fullSlug: "kosmetika/dekorativni-kosmetika/doplnky", newLeaf: "Doplňky" };
  return { fullSlug: "kosmetika/dekorativni-kosmetika/tvar", newLeaf: "Tvář" };
}

// kosmetika/plet
function classifyPlet(n: string): { fullSlug?: string } {
  const l = n.toLowerCase();
  if (/lash|brow/.test(l)) return { fullSlug: "kosmetika/plet/pece-o-rasy-a-oboci" };
  if (/toner|toning|essence water/.test(l)) return { fullSlug: "kosmetika/plet/cisteni-pleti" };
  if (/scrub|peeling|peeling pad|toner pad/.test(l)) return { fullSlug: "kosmetika/plet/pletove-peelingy" };
  if (/serum|essence|ampoule/.test(l)) return { fullSlug: "kosmetika/plet/pletova-sera" };
  if (/\bset\b|kit\b/.test(l)) return { fullSlug: /serum/.test(l) ? "kosmetika/plet/pletova-sera" : "kosmetika/plet/pletove-kremy" };
  return { fullSlug: "kosmetika/plet/pletove-kremy" }; // oils, butters, balms, creams default
}

// kosmetika/vlasy
function classifyVlasy(n: string): { fullSlug?: string } {
  const l = n.toLowerCase();
  if (/hair touch up/.test(l)) return { fullSlug: "kosmetika/vlasy/styling" };
  if (/conditioner|balm\b/.test(l) && !/\bset\b/.test(l)) return { fullSlug: "kosmetika/vlasy/kondicionery-a-balzamy" };
  if (/purify scalp|revitalizing treatment|hairloss lotion|hair loss.*tonic|scalp lotion|babysquam/.test(l)) return { fullSlug: "kosmetika/vlasy/vlasova-tonika" };
  if (/\bset\b.*(shampoo|conditioner)|shampoo.*conditioner/.test(l)) return { fullSlug: "kosmetika/vlasy/sampony" };
  return { fullSlug: "kosmetika/vlasy/vlasova-sera" }; // treatments, oils, serums, elixirs, infusions default
}

// domacnost — some genuine home-fragrance items plus catalog debris
// (kitchen knives, a toy, a bedsheet) that's off-concept for a perfume shop.
// Those are deliberately left unclassified for the user's own cleanup pass.
function classifyDomacnost(n: string): { fullSlug?: string; offConcept?: boolean } {
  const l = n.toLowerCase();
  if (/osvěžovač vzduchu ve spreji/.test(l)) return { fullSlug: "domacnost/osvezovace-vzduchu/sprej" };
  if (/candle warmer|nahřívací lucerna/.test(l)) return { fullSlug: "vonne-svicky" };
  if (/scented cards|laundry booster/.test(l)) return { fullSlug: "domacnost/osvezovace-vzduchu/vune-do-skrine" };
  return { offConcept: true };
}

// kosmetika (bare)
function classifyKosmetika(n: string): { fullSlug?: string; offConcept?: boolean } {
  const l = n.toLowerCase();
  if (/sprchový gel|shower gel/.test(l)) return { fullSlug: "kosmetika/sprchove-gely" };
  if (/micelar water|micellar water|cleansing water|cleansing foam|květinová voda/.test(l)) return { fullSlug: "kosmetika/plet/cisteni-pleti" };
  if (/body butter/.test(l)) return { fullSlug: "kosmetika/telo/telova-mleka" };
  if (/facial oil|moisturising lotion|capsule cream|reedle shot/.test(l)) return { fullSlug: "kosmetika/plet/pletove-kremy" };
  if (/infusion|hair/.test(l)) return { fullSlug: "kosmetika/vlasy/vlasova-sera" };
  if (/water bottle/.test(l)) return { offConcept: true };
  return {};
}

// pece-o-zdravi (bare) — now has real children (kondomy/masazni-gely/
// tehotenske-testy from the Tamda import), so leftovers need a home too.
function classifyPeceOZdravi(n: string): { fullSlug?: string; newLeaf?: string } {
  const l = n.toLowerCase();
  if (/skyn |durex|kondom/.test(l)) return { fullSlug: "pece-o-zdravi/kondomy" };
  return { fullSlug: "pece-o-zdravi/ostatni", newLeaf: "Ostatní" };
}

async function processBucket(
  slug: string,
  classify: (name: string) => { fullSlug?: string; newLeaf?: string; offConcept?: boolean },
  apply: boolean,
) {
  const cat = await prisma.category.findUnique({ where: { fullSlug: slug } });
  if (!cat) return;
  const products = await prisma.product.findMany({
    where: { categories: { some: { categoryId: cat.id } } },
    select: { id: true, name: true },
  });
  if (products.length === 0) return;

  const categoryIdCache = new Map<string, string>();
  const counts = new Map<string, number>();
  const offConcept: string[] = [];

  for (const p of products) {
    const target = classify(p.name);
    if (target.offConcept || !target.fullSlug) {
      offConcept.push(p.name);
      continue;
    }
    counts.set(target.fullSlug, (counts.get(target.fullSlug) ?? 0) + 1);
    if (apply) {
      const categoryId = await ensureCategory(categoryIdCache, target.fullSlug, target.newLeaf);
      await prisma.productCategory.deleteMany({ where: { productId: p.id } });
      await prisma.productCategory.create({ data: { productId: p.id, categoryId } });
    }
  }

  console.log(`\n=== ${slug} (${products.length} total) ===`);
  console.log("Reassigned:", Object.fromEntries(counts));
  if (offConcept.length) console.log(`Left as-is / off-concept (${offConcept.length}):`, offConcept.join(" | "));
}

async function main() {
  const apply = process.argv.includes("--apply");
  await processBucket("zuby", classifyZuby, apply);
  await processBucket("kosmetika/telo", classifyTelo, apply);
  await processBucket("parfemy", (n) => classifyParfemy(n), apply);
  await processBucket("parfemy/damske-parfemy", (n) => classifyParfemy(n, "damske"), apply);
  await processBucket("parfemy/panske-parfemy", (n) => classifyParfemy(n, "panske"), apply);
  await processBucket("parfemy/unisex-parfemy", (n) => classifyParfemy(n, "unisex"), apply);
  await processBucket("kosmetika/dekorativni-kosmetika", classifyDekorativni, apply);
  await processBucket("kosmetika/plet", classifyPlet, apply);
  await processBucket("kosmetika/vlasy", classifyVlasy, apply);
  await processBucket("domacnost", classifyDomacnost, apply);
  await processBucket("kosmetika", classifyKosmetika, apply);
  await processBucket("pece-o-zdravi", classifyPeceOZdravi, apply);
}
main().catch(console.error).finally(() => prisma.$disconnect());
