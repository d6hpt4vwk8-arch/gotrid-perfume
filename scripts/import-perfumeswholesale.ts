// One-off import for perfumes-wholesale.eu (m2.znzelectronics.cz) catalog CSV feed.
// Product photos aren't in the feed (catalog-only account, API confirmed no image
// endpoint) — scraped separately from the live site's product listing pages and
// matched here by productNo. Coverage is ~78% (9,723 of 12,463 SKUs); the rest
// import without a photo and stay hidden (visible: imageUrls.length > 0), same
// convention as scripts/import-spventure.ts.
//
// Usage:
//   npx tsx scripts/import-perfumeswholesale.ts --dry-run
//   npx tsx scripts/import-perfumeswholesale.ts --limit=20
//   npx tsx scripts/import-perfumeswholesale.ts
import { readFileSync } from "node:fs";
import { prisma } from "../src/lib/prisma";
import { downloadProductImages } from "../src/lib/import/download-images";
import { slugify } from "../src/lib/slug";

const CSV_PATH = process.argv.find((a) => a.startsWith("--file="))?.split("=")[1]
  ?? "scripts/data/perfumeswholesale-catalog.csv";
const IMAGES_PATH = "scripts/data/perfumeswholesale-images.json";
const DRY_RUN = process.argv.includes("--dry-run");
const LIMIT = Number(process.argv.find((a) => a.startsWith("--limit="))?.split("=")[1] ?? "0");
const CONCURRENCY = 6;

const DEFAULT_VAT_RATE = 21;
const CODE_PREFIX = "PWH-";

interface RawItem {
  productNo: string;
  price: number;
  stock: number;
  product: string;
  manufacturer: string;
  ean: string;
  gender: string;
  categoryRoot: string;
  category: string;
}

function parseCsv(content: string): RawItem[] {
  const cleaned = content.replace(/\x00/g, "").replace(/^﻿/, "");
  const lines = cleaned.split("\r\n").filter((l) => l.length > 0);
  const header = lines[0].split("\t");
  const idx = (name: string) => header.indexOf(name);
  const iProductNo = idx("productNo");
  const iAvailability = idx("availability");
  const iPrice = idx("price");
  const iProduct = idx("product");
  const iManufacturer = idx("manufacturer");
  const iEan = idx("EAN");
  const iGender = idx("gender");
  const iCategoryRoot = idx("category_root");
  const iCategory = idx("category");

  const items: RawItem[] = [];
  for (let li = 1; li < lines.length; li++) {
    const cols = lines[li].split("\t");
    const ean = (cols[iEan] ?? "").trim();
    if (!ean) continue;
    items.push({
      productNo: (cols[iProductNo] ?? "").trim(),
      stock: parseInt(cols[iAvailability] ?? "0", 10) || 0,
      price: parseFloat(cols[iPrice] ?? "0") || 0,
      product: (cols[iProduct] ?? "").trim(),
      manufacturer: (cols[iManufacturer] ?? "").trim(),
      ean,
      gender: (cols[iGender] ?? "").trim(),
      categoryRoot: (cols[iCategoryRoot] ?? "").trim(),
      category: (cols[iCategory] ?? "").trim(),
    });
  }
  return items;
}

// Keyword rules run in order, first match wins, against the lowercased
// `category` column. Not an exhaustive hand-map (708 distinct category
// strings) — a pragmatic pass covering the bulk of volume, with a per-root
// fallback (kosmetika / parfemy-by-gender) for anything unmatched.
type Rule = { test: RegExp; fullSlug: string };

const PERFUME_RULES: Rule[] = [
  { test: /candle/, fullSlug: "vonne-svicky" },
  { test: /car scent/, fullSlug: "vune-do-auta" },
  { test: /(room spray|interior scent|diffuser)/, fullSlug: "aroma-difuzery" },
  { test: /gift set/, fullSlug: "parfemy/darkove-sady" },
  { test: /(deodorant|deostick|antiperspirant)/, fullSlug: "kosmetika/telo/deodoranty" },
  { test: /(shower gel|shower oil|shower foam|bath foam)/, fullSlug: "kosmetika/sprchove-gely" },
  { test: /soap/, fullSlug: "kosmetika/telo/mydla" },
  { test: /(body lotion|body cream|body souffle|body butter|body oil|body scrub|hair.{0,3}body mist)/, fullSlug: "kosmetika/telo/telova-mleka" },
  { test: /hand (cream|balm)/, fullSlug: "kosmetika/telo/krem-na-ruce" },
  { test: /after shave/, fullSlug: "kosmetika/telo/depilace" },
  { test: /(hair mist|hair perfume)/, fullSlug: "kosmetika/vlasy" },
  { test: /\boil\b/, fullSlug: null as unknown as string }, // handled per-gender below (parfemovane-oleje) — word-boundary avoids matching "toilette"
  { test: /(eau de toilette|cologne)/, fullSlug: null as unknown as string }, // toaletni-vody
  { test: /(eau de parfum|extrait|parfum|essence de parfum)/, fullSlug: null as unknown as string }, // parfemovane-vody
];

function genderFolder(gender: string): "damske-parfemy" | "panske-parfemy" | "unisex-parfemy" {
  const g = gender.toLowerCase();
  if (g.includes("female") && g.includes("male")) return "unisex-parfemy";
  if (g.includes("female")) return "damske-parfemy";
  if (g.includes("male")) return "panske-parfemy";
  return "unisex-parfemy";
}

function resolvePerfumeCategory(category: string, gender: string): string {
  const c = category.toLowerCase();
  for (const rule of PERFUME_RULES) {
    if (!rule.test.test(c)) continue;
    if (rule.fullSlug) return rule.fullSlug;
    const folder = genderFolder(gender);
    if (/\boil\b/.test(c)) return `parfemy/${folder}/parfemovane-oleje`;
    if (/(eau de toilette|cologne)/.test(c)) return `parfemy/${folder}/toaletni-vody`;
    return `parfemy/${folder}/parfemovane-vody`;
  }
  return `parfemy/${genderFolder(gender)}`;
}

const COSMETICS_RULES: Rule[] = [
  { test: /(toothpaste|toothbrush|mouthwash|interdental)/, fullSlug: "zuby" },
  { test: /(condom|pregnancy test|massage)/, fullSlug: "pece-o-zdravi/ostatni" },
  { test: /(mascara|eyeliner|eye pencil|eyeshadow|brow|eye shadow)/, fullSlug: "kosmetika/dekorativni-kosmetika/oci" },
  { test: /(lipstick|lip gloss|lip liner|lip balm|lip pencil|lip care)/, fullSlug: "kosmetika/dekorativni-kosmetika/rty" },
  { test: /(nail polish|nail)/, fullSlug: "kosmetika/dekorativni-kosmetika/nehty" },
  { test: /(foundation|concealer|blush|highlighter|powder|make-?up|cc cream|bb cream)/, fullSlug: "kosmetika/dekorativni-kosmetika/tvar" },
  { test: /(shampoo|conditioner|hair mask|hair serum|hair oil|hair tonic)/, fullSlug: "kosmetika/vlasy" },
  { test: /(hair spray|hair gel|hair wax|hair paste|hair mousse|hair foam|hair cream|hair clay|pomade|styling)/, fullSlug: "kosmetika/vlasy/styling" },
  { test: /hair color/, fullSlug: "kosmetika/vlasy/barvy-na-vlasy" },
  { test: /(face serum|facial serum|face essence|facial essence)/, fullSlug: "kosmetika/plet/pletova-sera" },
  { test: /(face mask|facial mask)/, fullSlug: "kosmetika/plet/pletove-masky" },
  { test: /(peeling|exfoliat)/, fullSlug: "kosmetika/plet/pletove-peelingy" },
  { test: /(cleansing|micellar|make-?up remov|cleansing water|cleansing milk|cleansing balm|toner)/, fullSlug: "kosmetika/plet/cisteni-pleti" },
  { test: /(lash|brow)/, fullSlug: "kosmetika/plet/pece-o-rasy-a-oboci" },
  { test: /(face|facial|skin).{0,20}(cream|gel-creme|fluid|emulsion)/, fullSlug: "kosmetika/plet/pletove-kremy" },
  { test: /(deodorant|antiperspirant)/, fullSlug: "kosmetika/telo/deodoranty" },
  { test: /(sunscreen|sun protection|after-?sun|tanning|sunbathing)/, fullSlug: "kosmetika/telo/opalovaci-kosmetika" },
  { test: /(shave|shaving|razor)/, fullSlug: "kosmetika/telo/depilace" },
  { test: /hand.{0,3}(cream|balm)/, fullSlug: "kosmetika/telo/krem-na-ruce" },
  { test: /(shower gel|shower cream|shower oil|shower foam|bath)/, fullSlug: "kosmetika/telo/sprcha-a-koupel" },
  { test: /(body lotion|body cream|body oil|body butter|body scrub|body serum|body water)/, fullSlug: "kosmetika/telo/telova-mleka" },
  { test: /gift set/, fullSlug: "kosmetika/telo/darkove-sady" },
];

function resolveCosmeticsCategory(category: string): string {
  const c = category.toLowerCase();
  for (const rule of COSMETICS_RULES) {
    if (rule.test.test(c)) return rule.fullSlug;
  }
  return "kosmetika";
}

function resolveCategoryFullSlug(item: RawItem): string {
  if (item.categoryRoot === "Perfumes") return resolvePerfumeCategory(item.category, item.gender);
  return resolveCosmeticsCategory(item.category);
}

async function getOrCreateCategoryId(cache: Map<string, string | null>, fullSlug: string): Promise<string | null> {
  if (cache.has(fullSlug)) return cache.get(fullSlug)!;
  const cat = await prisma.category.findUnique({ where: { fullSlug } });
  if (!cat) {
    console.warn(`  [warn] category fullSlug not found: ${fullSlug}, skipping category assignment`);
    cache.set(fullSlug, null);
    return null;
  }
  cache.set(fullSlug, cat.id);
  return cat.id;
}

async function resolveBrandId(cache: Map<string, string>, brandName: string): Promise<string | null> {
  const trimmed = brandName.trim();
  if (!trimmed) return null;
  const slug = slugify(trimmed);
  if (cache.has(slug)) return cache.get(slug)!;
  try {
    const brand = await prisma.brand.upsert({
      where: { slug },
      update: {},
      create: { name: trimmed, slug },
    });
    cache.set(slug, brand.id);
    return brand.id;
  } catch {
    const existing = await prisma.brand.findUnique({ where: { slug } });
    if (existing) {
      cache.set(slug, existing.id);
      return existing.id;
    }
    throw new Error(`Could not resolve or create brand "${trimmed}"`);
  }
}

async function processInBatches<T>(items: T[], size: number, fn: (item: T, index: number) => Promise<void>) {
  for (let i = 0; i < items.length; i += size) {
    const batch = items.slice(i, i + size);
    await Promise.all(batch.map((item, j) => fn(item, i + j)));
  }
}

async function main() {
  const csv = readFileSync(CSV_PATH, "utf-8");
  const all = parseCsv(csv);
  console.log(`Parsed ${all.length} rows (with EAN)`);

  const images: Record<string, string> = JSON.parse(readFileSync(IMAGES_PATH, "utf-8"));
  console.log(`Loaded ${Object.keys(images).length} scraped product images`);

  // Dedupe by productNo (bulk-price-tier duplicate rows share the same base
  // `price` — confirmed by inspection — so keeping the first row is fine).
  const byProductNo = new Map<string, RawItem>();
  for (const item of all) {
    if (!byProductNo.has(item.productNo)) byProductNo.set(item.productNo, item);
  }
  console.log(`Unique by productNo: ${byProductNo.size}`);

  // Then dedupe by EAN (cheapest price wins), matching the SP Venture convention.
  const byEan = new Map<string, RawItem>();
  for (const item of byProductNo.values()) {
    const existing = byEan.get(item.ean);
    if (!existing || item.price < existing.price) byEan.set(item.ean, item);
  }
  console.log(`Unique by EAN: ${byEan.size}`);

  const eans = [...byEan.keys()];
  const existingProducts = await prisma.product.findMany({
    where: { ean: { in: eans } },
    select: { id: true, ean: true, code: true },
  });
  const existingByEan = new Map(existingProducts.map((p) => [p.ean!, p]));

  let toProcess = [...byEan.values()];
  if (LIMIT > 0) toProcess = toProcess.slice(0, LIMIT);
  const withImage = toProcess.filter((i) => images[i.productNo]).length;
  console.log(
    `Will process: ${toProcess.length} (new: ${toProcess.filter((i) => !existingByEan.has(i.ean)).length}, ` +
    `update: ${toProcess.filter((i) => existingByEan.has(i.ean)).length}, with image: ${withImage})`
  );

  if (DRY_RUN && process.env.CATEGORY_REPORT) {
    const counts = new Map<string, number>();
    for (const item of toProcess) {
      const slug = resolveCategoryFullSlug(item);
      counts.set(slug, (counts.get(slug) ?? 0) + 1);
    }
    for (const [slug, n] of [...counts.entries()].sort((a, b) => b[1] - a[1])) {
      console.log(`${n}\t${slug}`);
    }
  }

  if (DRY_RUN) {
    const sample = toProcess.slice(0, 15);
    console.log("\nSample category resolution:");
    for (const item of sample) {
      console.log(`  [${item.categoryRoot} / ${item.category} / gender=${item.gender}] -> ${resolveCategoryFullSlug(item)}  (${item.product})`);
    }
    console.log("\nDry run — stopping before any writes.");
    return;
  }

  const categoryCache = new Map<string, string | null>();
  const brandCache = new Map<string, string>();
  let created = 0;
  let updated = 0;
  let failed = 0;
  let processed = 0;

  await processInBatches(toProcess, CONCURRENCY, async (item) => {
    try {
      const sellPrice = Math.round(item.price * 1.21 * 1.2);
      const existing = existingByEan.get(item.ean);

      if (existing) {
        await prisma.product.update({
          where: { id: existing.id },
          data: { price: sellPrice, purchasePrice: item.price, stock: item.stock },
        });
        updated++;
      } else {
        const fullSlug = resolveCategoryFullSlug(item);
        const categoryId = await getOrCreateCategoryId(categoryCache, fullSlug);
        const brandId = await resolveBrandId(brandCache, item.manufacturer);

        const code = `${CODE_PREFIX}${item.productNo}`;
        const slug = `${slugify(item.product)}-${code.toLowerCase()}`;

        const imageUrl = images[item.productNo];
        const { urls: imageUrls } = imageUrl
          ? await downloadProductImages(code, imageUrl)
          : { urls: [] };

        const product = await prisma.product.create({
          data: {
            name: item.product,
            code,
            slug,
            ean: item.ean,
            brandId: brandId ?? undefined,
            price: sellPrice,
            purchasePrice: item.price,
            vatRate: DEFAULT_VAT_RATE,
            stock: item.stock,
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
      console.error(`  [error] EAN ${item.ean} (${item.product}):`, err instanceof Error ? err.message : err);
    }

    processed++;
    if (processed % 100 === 0) {
      console.log(`  progress: ${processed}/${toProcess.length} (created=${created} updated=${updated} failed=${failed})`);
    }
  });

  console.log(`\nDone. Created: ${created}, Updated: ${updated}, Failed: ${failed}`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
