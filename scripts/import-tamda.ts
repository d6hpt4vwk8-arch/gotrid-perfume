// One-off import for Tamda Express (tamdaexpress.eu) — a general Vietnamese/Czech
// wholesale grocery-and-drugstore B2B site with no product feed. Data was
// collected by scraping the ~23 category pages we actually want (skincare,
// oral care, air fresheners, body care, and a genuine perfume subcategory)
// while logged in via a browser session — see scripts/tamda-data/tamda-full-scrape.json.
//
// Usage:
//   npx tsx scripts/import-tamda.ts --dry-run
//   npx tsx scripts/import-tamda.ts --limit=20
//   npx tsx scripts/import-tamda.ts
import { readFileSync } from "node:fs";
import { prisma } from "../src/lib/prisma";
import { downloadProductImages } from "../src/lib/import/download-images";
import { slugify } from "../src/lib/slug";

const DATA_PATH = "scripts/tamda-data/tamda-full-scrape.json";
const DRY_RUN = process.argv.includes("--dry-run");
const LIMIT = Number(process.argv.find((a) => a.startsWith("--limit="))?.split("=")[1] ?? "0");
const CONCURRENCY = 6;
const DEFAULT_VAT_RATE = 21;

interface RawItem {
  id: string;
  name: string;
  url: string;
  ean: string | null;
  priceNoDiscount: number | null;
  image: string | null;
  stockText: string | null;
  category: string;
}

// Tamda's Czech category labels mapped onto this store's existing category
// tree by fullSlug — same "reuse what exists, NEW:parent>Child for real gaps"
// pattern as scripts/import-spventure.ts's CATEGORY_MAP. "Vůně (Parfémy)" is
// handled separately below (resolvePerfumeCategory) since it's real perfume,
// not drugstore/cosmetics.
const CATEGORY_MAP: Record<string, string> = {
  "Koupelová lázeň": "kosmetika/telo/sprcha-a-koupel",
  "Péče o problematickou pleť": "kosmetika/plet/cisteni-pleti",
  "Péče o řasy": "kosmetika/plet/pece-o-rasy-a-oboci",
  "Péče o ruce": "kosmetika/telo/krem-na-ruce",
  "Péče o rty": "NEW:kosmetika/plet>Péče o rty",
  "Sprchové gely": "kosmetika/sprchove-gely",
  "Pleťový krém": "kosmetika/plet/pletove-kremy",
  Mýdla: "kosmetika/telo/mydla",
  "Opalovací kosmetika": "kosmetika/telo/opalovaci-kosmetika",
  Kondomy: "NEW:pece-o-zdravi>Kondomy",
  "Masážní gely": "NEW:pece-o-zdravi>Masážní gely",
  "Těhotenské testy": "NEW:pece-o-zdravi>Těhotenské testy",
  "Pro bělení": "zuby/doplnky-k-cisteni-zubu",
  "Ústní voda": "zuby/ustni-vody",
  "Kartáčky na zuby": "zuby/zubni-kartacky",
  "Zubní pasta": "zuby/zubni-pasty",
  "Pro pokoje": "NEW:domacnost/osvezovace-vzduchu>Pro pokoje",
  "Vůně do skříně": "NEW:domacnost/osvezovace-vzduchu>Vůně do skříně",
  "Pro WC": "NEW:domacnost/osvezovace-vzduchu>Pro WC",
  Sprej: "NEW:domacnost/osvezovace-vzduchu>Sprej",
  "Deodoranty (sticks)": "kosmetika/telo/deodoranty",
  Deodoranty: "kosmetika/telo/deodoranty",
};

// Curated from a manual pass over the ~2266 scraped names (see
// scripts/tamda-data/test-brand-match2.ts) — Tamda's listing has no separate
// brand field, so this hand-verified prefix list is safer than guessing "the
// first word is the brand," which would create nonsense brands like "Gel" or
// "Pasta" from generic Czech product-type words. Longer (multi-word) entries
// must come first so e.g. "Fresh Juice" wins over a bare "Fresh" match.
const KNOWN_BRAND_PREFIXES = [
  "Air Breeze",
  "Ambi Pur",
  "General Fresh",
  "Fresh Juice",
  "Fresh Air",
  "Jean Marc",
  "Dr. Beckmann",
  "Dr. Devil",
  "Miss Life",
  "On Line Le Petit",
  "Clean & Clear",
  "Clean&Clear",
  "Chopa",
  "Blend-a-dent",
  "Blend-a-med",
  "Oral-B",
  "Tesori d'Oriente",
  "Tesori dOriente",
  "Lilien Naturalis",
  "STR8",
  "Embfresh",
  "Palmolive",
  "Brait",
  "Colgate",
  "Palacio",
  "Lilien",
  "Bref",
  "Kolorado",
  "Rexona",
  "Indulona",
  "Lactovit",
  "Playboy",
  "Labello",
  "Mitia",
  "Jordan",
  "Devoré",
  "Sunnoré",
  "Herbavera",
  "Lara",
  "Laura",
  "Frosch",
  "Miléne",
  "Signal",
  "Pepino",
  "Domestos",
  "Lavon",
  "Filachem",
  "Protex",
  "Vademecum",
  "Elode",
  "Sofines",
  "Helle",
  "Meridol",
  "Neutrogena",
  "Kamill",
  "Solvina",
  "Vaseline",
  "Dermomed",
  "Odol",
  "Dettol",
  "Denim",
  "Durex",
  "Zidac",
  "Mattes",
  "TePe",
  "Arôme",
  "Glade",
  "Concertino",
  "Amia",
  "Eva",
  "Rebicek",
  "Truesmile",
  "AmbiPur",
  "Coral",
  "Fila",
  "Inkee",
  "Aknelot",
  "Milmil",
  "Sanytol",
  "Nibo",
  "Radox",
  "Reebok",
  "Pedik",
  "Voux",
  "Banat",
  "Dentek",
  "Antica",
  "Promise",
  "Savo",
  "Mixa",
  "Purol",
  "Aquafresh",
  "Benefit",
  "Orion",
  "Gillette",
  "Loreal",
  "Kneipp",
  "Sukin",
  "Darsi",
  "Regina",
  "Collini",
  "Gallus",
  "Luna",
  "Milo",
  "Lipzo",
  "Clinomyn",
  "Parodontax",
  "Woods",
  "Papilion",
  "B.U",
  "Adidas",
  "Pink Elephant",
  "Deep Fresh",
  "Organic Shop",
  "Cit",
  "Lavonea",
  "Naturalis",
  "Air Wick",
  "Air Plus Botanica",
  "Pasta del Capitano",
  "White Glo",
  "Atlantic",
  "Herbal care",
  "OralB",
  "Garnier",
  "Rebi Dental",
];

function parseVatIncludedPrice(priceInclVat: number): { purchasePrice: number; sellPrice: number } {
  // User-confirmed: Tamda's displayed prices already include VAT. Strip it
  // to get our usual ex-VAT purchase basis, then reapply the store's normal
  // formula (purchase × 1.21 × 1.2) — the two 1.21s cancel, so the sell
  // price is simply the Tamda price × 1.2.
  const purchasePrice = priceInclVat / 1.21;
  const sellPrice = Math.round(priceInclVat * 1.2);
  return { purchasePrice, sellPrice };
}

function parseStock(stockText: string | null): number {
  if (!stockText) return 0;
  const match = /Skladem\s+(>?)(\d+)ks/.exec(stockText);
  if (!match) return 0;
  const [, over, num] = match;
  return over ? 100 : parseInt(num, 10);
}

// `\b` is ASCII-only in JS's default (non-Unicode) regex mode — it doesn't
// treat accented letters (á, í, ý…) as word characters, so a trailing `\b`
// right after one (e.g. "pánská") silently fails to match. Using a
// lookahead for "not-a-letter" instead of `\b` on that side sidesteps it.
const NOT_LETTER = "(?![a-zá-žýřůěščťžĎŇŘŠŤŽ])";
const MALE_MARKERS = new RegExp(`\\bM\\b|\\bpánsk[áý]${NOT_LETTER}|\\bmužsk[áý]${NOT_LETTER}|\\bmen\\b|\\bman\\b`, "i");
const FEMALE_MARKERS = new RegExp(`\\bW\\b|\\bwomen\\b|\\bwoman\\b|\\bfemale\\b|\\bmiss\\b|\\bdámsk[áý]${NOT_LETTER}`, "i");
const EDP_MARKERS = new RegExp(`\\bEDP\\b|\\bparf[ée]mov[áa] voda${NOT_LETTER}`, "i");

// Products that showed up in Tamda's "Vůně" (fragrance) listing but aren't
// actually perfume — e.g. plug-in air-freshener refills ("náhradní náplň")
// like Brait/Ambi Pur/Woods. Route those into the air-freshener tree instead.
const AIR_FRESHENER_REFILL_MARKER = /náhradní náplň/i;

function resolvePerfumeCategory(name: string): string {
  const genderSlug = MALE_MARKERS.test(name)
    ? "panske-parfemy"
    : FEMALE_MARKERS.test(name)
      ? "damske-parfemy"
      : "unisex-parfemy";
  const concentrationSlug = EDP_MARKERS.test(name)
    ? "parfemovane-vody"
    : "toaletni-vody"; // default for EDT and unlabeled body-fragrance-style entries
  return `parfemy/${genderSlug}/${concentrationSlug}`;
}

// Tamda's "Sprej" (spray) bucket, like "Vůně", isn't purely air fresheners —
// it also holds deodorant/antiperspirant body sprays (e.g. several Old Spice
// "deodorant 150ml" entries showed up there instead of under Deodoranty).
const DEODORANT_MARKER = /\b(deodorant|antiperspirant)\b/i;

function resolveCategoryTarget(item: RawItem): { fullSlug?: string; newPath?: string } {
  if (item.category === "Vůně (Parfémy)") {
    if (AIR_FRESHENER_REFILL_MARKER.test(item.name)) {
      return { newPath: "domacnost/osvezovace-vzduchu::Pro pokoje" };
    }
    return { fullSlug: resolvePerfumeCategory(item.name) };
  }
  if (item.category === "Sprej" && DEODORANT_MARKER.test(item.name)) {
    return { fullSlug: "kosmetika/telo/deodoranty" };
  }
  const mapped = CATEGORY_MAP[item.category];
  if (!mapped) return { fullSlug: "kosmetika" };
  if (mapped.startsWith("NEW:")) {
    const [parentSlug, childName] = mapped.slice(4).split(">");
    return { newPath: `${parentSlug}::${childName}` };
  }
  return { fullSlug: mapped };
}

// Existing DB brand names (from prior imports — SP Venture, the legacy
// Shoptet catalog, etc.) checked before the curated list, longest first so
// e.g. "Old Spice" wins over any shorter accidental prefix. Missing this
// check the first time around left ~40% of new Tamda rows brandless even
// though their brand ("Old Spice" among them) already existed in the DB.
function resolveBrandName(name: string, existingBrandNames: string[]): string | null {
  const lower = name.toLowerCase();
  for (const brand of existingBrandNames) {
    const bl = brand.toLowerCase();
    if (lower === bl || lower.startsWith(bl + " ")) return brand;
  }
  for (const brand of KNOWN_BRAND_PREFIXES) {
    const bl = brand.toLowerCase();
    if (lower === bl || lower.startsWith(bl + " ")) return brand;
  }
  return null;
}

async function getOrCreateCategoryId(
  cache: Map<string, string>,
  target: { fullSlug?: string; newPath?: string },
): Promise<string | null> {
  if (target.fullSlug) {
    if (cache.has(target.fullSlug)) return cache.get(target.fullSlug)!;
    const cat = await prisma.category.findUnique({ where: { fullSlug: target.fullSlug } });
    if (!cat) {
      console.warn(`  [warn] category fullSlug not found: ${target.fullSlug}`);
      return null;
    }
    cache.set(target.fullSlug, cat.id);
    return cat.id;
  }
  if (target.newPath) {
    if (cache.has(target.newPath)) return cache.get(target.newPath)!;
    const [parentSlug, childName] = target.newPath.split("::");
    const parent = await prisma.category.findUnique({ where: { fullSlug: parentSlug } });
    if (!parent) {
      console.warn(`  [warn] parent category not found: ${parentSlug}`);
      return null;
    }
    const childSlug = slugify(childName);
    const fullSlug = `${parentSlug}/${childSlug}`;
    try {
      const created = await prisma.category.upsert({
        where: { fullSlug },
        update: {},
        create: { name: childName, slug: childSlug, fullSlug, parentId: parent.id },
      });
      cache.set(target.newPath, created.id);
      return created.id;
    } catch {
      // Same concurrent-batch race as resolveBrandId below: another item in
      // this batch already created it between our check and insert.
      const existing = await prisma.category.findUnique({ where: { fullSlug } });
      if (existing) {
        cache.set(target.newPath, existing.id);
        return existing.id;
      }
      throw new Error(`Could not resolve or create category "${fullSlug}"`);
    }
  }
  return null;
}

async function resolveBrandId(cache: Map<string, string>, brandName: string): Promise<string | null> {
  const slug = slugify(brandName);
  if (cache.has(slug)) return cache.get(slug)!;
  try {
    const brand = await prisma.brand.upsert({
      where: { slug },
      update: {},
      create: { name: brandName, slug },
    });
    cache.set(slug, brand.id);
    return brand.id;
  } catch {
    // Same concurrent-batch race as import-spventure.ts's resolveBrandId.
    const existing = await prisma.brand.findUnique({ where: { slug } });
    if (existing) {
      cache.set(slug, existing.id);
      return existing.id;
    }
    throw new Error(`Could not resolve or create brand "${brandName}"`);
  }
}

async function processInBatches<T>(items: T[], size: number, fn: (item: T, index: number) => Promise<void>) {
  for (let i = 0; i < items.length; i += size) {
    const batch = items.slice(i, i + size);
    await Promise.all(batch.map((item, j) => fn(item, i + j)));
  }
}

async function main() {
  const raw = JSON.parse(readFileSync(DATA_PATH, "utf-8")) as Record<string, RawItem[]>;
  const all: RawItem[] = [];
  for (const arr of Object.values(raw)) all.push(...arr);
  console.log(`Parsed ${all.length} items across ${Object.keys(raw).length} categories`);

  const withEan = all.filter((item) => item.ean);
  console.log(`With EAN: ${withEan.length} (dropped ${all.length - withEan.length} without one)`);

  const byEan = new Map<string, RawItem>();
  for (const item of withEan) {
    const price = item.priceNoDiscount ?? Infinity;
    const existing = byEan.get(item.ean!);
    const existingPrice = existing?.priceNoDiscount ?? Infinity;
    if (!existing || price < existingPrice) byEan.set(item.ean!, item);
  }
  console.log(`Unique by EAN: ${byEan.size}`);

  const eans = [...byEan.keys()];
  const existingProducts = await prisma.product.findMany({
    where: { ean: { in: eans } },
    select: { id: true, ean: true, price: true },
  });
  const existingByEan = new Map(existingProducts.map((p) => [p.ean!, p]));

  let toProcess = [...byEan.values()];
  if (LIMIT > 0) toProcess = toProcess.slice(0, LIMIT);
  console.log(
    `Will process: ${toProcess.length} (new: ${toProcess.filter((i) => !existingByEan.has(i.ean!)).length}, update: ${toProcess.filter((i) => existingByEan.has(i.ean!)).length})`,
  );

  if (DRY_RUN) {
    console.log("Dry run — stopping before any writes.");
    return;
  }

  const existingBrandNames = (await prisma.brand.findMany({ select: { name: true } }))
    .map((b) => b.name)
    .sort((a, b) => b.length - a.length);

  // Two-level categories (domacnost/osvezovace-vzduchu) need their
  // intermediate parent to exist before getOrCreateCategoryId's one-level
  // NEW: mechanism can create the leaf children under it.
  const airFreshenerParent = await prisma.category.findUnique({ where: { fullSlug: "domacnost" } });
  if (airFreshenerParent) {
    await prisma.category.upsert({
      where: { fullSlug: "domacnost/osvezovace-vzduchu" },
      update: {},
      create: {
        name: "Osvěžovače vzduchu",
        slug: "osvezovace-vzduchu",
        fullSlug: "domacnost/osvezovace-vzduchu",
        parentId: airFreshenerParent.id,
      },
    });
  } else {
    console.warn("  [warn] parent category 'domacnost' not found — air freshener subcategories will fail");
  }

  const categoryCache = new Map<string, string>();
  const brandCache = new Map<string, string>();
  let created = 0;
  let updated = 0;
  let failed = 0;
  let skippedNoPrice = 0;
  let processed = 0;

  await processInBatches(toProcess, CONCURRENCY, async (item) => {
    try {
      if (item.priceNoDiscount === null) {
        skippedNoPrice++;
        return;
      }
      const { purchasePrice, sellPrice } = parseVatIncludedPrice(item.priceNoDiscount);
      const existing = existingByEan.get(item.ean!);
      const stock = parseStock(item.stockText);

      if (existing) {
        if (sellPrice < Number(existing.price)) {
          await prisma.product.update({
            where: { id: existing.id },
            data: { price: sellPrice, purchasePrice, stock },
          });
        } else {
          await prisma.product.update({ where: { id: existing.id }, data: { stock } });
        }
        updated++;
      } else {
        const categoryTarget = resolveCategoryTarget(item);
        const categoryId = await getOrCreateCategoryId(categoryCache, categoryTarget);
        const brandName = resolveBrandName(item.name, existingBrandNames);
        const brandId = brandName ? await resolveBrandId(brandCache, brandName) : null;

        const code = `TDE-${item.id}`;
        const slug = `${slugify(item.name)}-${code.toLowerCase()}`;

        const { urls: imageUrls } = item.image
          ? await downloadProductImages(code, item.image)
          : { urls: [] };

        const product = await prisma.product.create({
          data: {
            name: item.name,
            code,
            slug,
            ean: item.ean,
            brandId: brandId ?? undefined,
            price: sellPrice,
            purchasePrice,
            vatRate: DEFAULT_VAT_RATE,
            stock,
            visible: imageUrls.length > 0,
          },
        });
        if (categoryId) {
          await prisma.productCategory.create({ data: { productId: product.id, categoryId } });
        }
        if (imageUrls.length > 0) {
          await prisma.productImage.create({
            data: { productId: product.id, url: imageUrls[0], sortOrder: 0 },
          });
        }
        created++;
      }
    } catch (err) {
      failed++;
      console.error(`  [error] EAN ${item.ean} (${item.name}):`, err instanceof Error ? err.message : err);
    }

    processed++;
    if (processed % 100 === 0) {
      console.log(`  progress: ${processed}/${toProcess.length} (created=${created} updated=${updated} failed=${failed})`);
    }
  });

  console.log(
    `\nDone. Created: ${created}, Updated: ${updated}, Failed: ${failed}, Skipped (no price): ${skippedNoPrice}`,
  );
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
