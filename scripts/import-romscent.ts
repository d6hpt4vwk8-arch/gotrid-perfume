// One-off import for Romscent (romscent.com) live Atom product feed.
// Scope: pre-approved 758-row selection from the static "romscent stock offer
// 0608.xlsx" file (20 named Arabic brands + every designer/niche-type row),
// restricted here to the subset also present (by EAN) in the live feed
// (which carries real product photos) and not already in our catalog by EAN.
//
// Usage:
//   npx tsx scripts/import-romscent.ts --dry-run
//   npx tsx scripts/import-romscent.ts --limit=20
//   npx tsx scripts/import-romscent.ts
import { readFileSync } from "node:fs";
import { prisma } from "../src/lib/prisma";
import { downloadProductImages } from "../src/lib/import/download-images";
import { slugify } from "../src/lib/slug";

const NEW_ITEMS_PATH = "/tmp/romscent_new_items.json";
const DRY_RUN = process.argv.includes("--dry-run");
const LIMIT = Number(process.argv.find((a) => a.startsWith("--limit="))?.split("=")[1] ?? "0");
const CONCURRENCY = 6;

const DEFAULT_VAT_RATE = 21;
const EUR_TO_CZK = 24.163;
const MARKUP = 1.30;

const ARABIC_BRANDS = new Set([
  "fragrance world", "french avenue", "gulf orchid", "khadlaj", "emir",
  "arabiyat prestige", "maison asrar", "auraa desire", "rayhaan",
  "arabiyat sugar", "matin martin", "anfar 1950", "anfar london",
  "la fede", "north stag", "al haramain", "ministry of oud", "nylaa",
  "afnan", "monster",
]);

interface NewItem {
  static: {
    ean: string;
    sku: number;
    type: string;
    category: string;
    brand: string;
    name: string;
    stock: string;
    offer: number;
  };
  feed: {
    id: string;
    name: string;
    brand: string;
    category: string;
    ean: string;
    ean2: string | null;
    price: string;
    stock: string;
    added: string;
    image: string;
  };
}

function resolveCategorySlug(item: NewItem): string {
  const brand = item.static.brand.trim().toLowerCase();
  if (ARABIC_BRANDS.has(brand)) return "parfemy/arabske-parfemy";

  const cat = item.static.category;
  if (cat === "Deodorants spray") return "kosmetika/telo/deodoranty";
  if (cat === "Fragrances gift sets") return "parfemy/darkove-sady";

  const isEdt = /eau de toilette|\bedt\b/i.test(item.static.name);
  const concentration = isEdt ? "toaletni-vody" : "parfemovane-vody";

  if (cat === "Men's fragrances") return `parfemy/panske-parfemy/${concentration}`;
  if (cat === "Women's fragrances") return `parfemy/damske-parfemy/${concentration}`;
  if (cat === "Unisex fragrances") return `parfemy/unisex-parfemy/${concentration}`;
  return "parfemy";
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
  const all: NewItem[] = JSON.parse(readFileSync(NEW_ITEMS_PATH, "utf-8"));
  console.log(`Loaded ${all.length} pre-reconciled new Romscent items`);

  // Re-verify none of these EANs slipped into the catalog since reconciliation.
  const eans = all.map((i) => i.static.ean);
  const existing = await prisma.product.findMany({
    where: { ean: { in: eans } },
    select: { ean: true },
  });
  const existingEans = new Set(existing.map((p) => p.ean));
  let toProcess = all.filter((i) => !existingEans.has(i.static.ean));
  console.log(`After re-check against live DB: ${toProcess.length} (skipped ${all.length - toProcess.length} already present)`);

  if (LIMIT > 0) toProcess = toProcess.slice(0, LIMIT);
  console.log(`Will process: ${toProcess.length}`);

  const categoryTally = new Map<string, number>();
  for (const item of toProcess) {
    const slug = resolveCategorySlug(item);
    categoryTally.set(slug, (categoryTally.get(slug) ?? 0) + 1);
  }
  console.log("Category breakdown:", Object.fromEntries(categoryTally));

  if (DRY_RUN) {
    console.log("Dry run — stopping before any writes.");
    const sample = toProcess.slice(0, 5).map((i) => ({
      ean: i.static.ean,
      name: i.feed.name,
      brand: i.static.brand,
      category: resolveCategorySlug(i),
      offerEur: i.feed.price,
      code: `ROM-${i.feed.id}`,
    }));
    console.log("Sample:", JSON.stringify(sample, null, 2));
    return;
  }

  const categoryCache = new Map<string, string>();
  const brandCache = new Map<string, string>();
  let created = 0;
  let failed = 0;
  let processed = 0;

  await processInBatches(toProcess, CONCURRENCY, async (item) => {
    try {
      const offerEur = parseFloat(item.feed.price);
      const purchasePriceCzk = Math.round(offerEur * EUR_TO_CZK * 1.21 * 100) / 100;
      const sellPrice = Math.round(purchasePriceCzk * MARKUP);

      const code = `ROM-${item.feed.id}`;
      const fullName = item.static.brand && !item.feed.name.toLowerCase().includes(item.static.brand.toLowerCase())
        ? `${item.static.brand} ${item.feed.name}`
        : item.feed.name;
      const slug = `${slugify(fullName)}-${code.toLowerCase()}`;

      let categoryId: string | null = null;
      const categorySlug = resolveCategorySlug(item);
      if (categoryCache.has(categorySlug)) {
        categoryId = categoryCache.get(categorySlug)!;
      } else {
        const cat = await prisma.category.findUnique({ where: { fullSlug: categorySlug } });
        if (cat) {
          categoryCache.set(categorySlug, cat.id);
          categoryId = cat.id;
        } else {
          console.warn(`  [warn] category not found: ${categorySlug}`);
        }
      }

      const brandId = await resolveBrandId(brandCache, item.static.brand);

      const { urls: imageUrls } = item.feed.image
        ? await downloadProductImages(code, item.feed.image)
        : { urls: [] };

      const product = await prisma.product.create({
        data: {
          name: fullName,
          code,
          slug,
          ean: item.static.ean,
          brandId: brandId ?? undefined,
          price: sellPrice,
          purchasePrice: purchasePriceCzk,
          vatRate: DEFAULT_VAT_RATE,
          stock: parseInt(item.feed.stock, 10) || 0,
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
    } catch (err) {
      failed++;
      console.error(`  [error] EAN ${item.static.ean} (${item.feed.name}):`, err instanceof Error ? err.message : err);
    }

    processed++;
    if (processed % 50 === 0) {
      console.log(`  progress: ${processed}/${toProcess.length} (created=${created} failed=${failed})`);
    }
  });

  console.log(`\nDone. Created: ${created}, Failed: ${failed}`);

  await prisma.adminActivityLog.create({
    data: {
      action: "product.bulk_import",
      entityType: "product",
      detail: `Import produktů od dodavatele Romscent (živý feed s fotkami): vytvořeno ${created}, chyby ${failed}. Kódy ROM-{id}, marže 30 % nad nákupní cenou v Kč (kurz ${EUR_TO_CZK}), arabské značky do kategorie Arabské parfémy.`,
    },
  });
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
