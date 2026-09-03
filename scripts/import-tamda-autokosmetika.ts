// Third Tamda Express batch — Autokosmetika (car/room air fresheners) only.
// Explicitly excludes the non-fragrance half of this Tamda category (Coyote
// windshield washer fluid, Sheron deicer/washer fluid, Dr. Marcus Ice
// Breaker) — those are car maintenance chemicals, not a fit for this store's
// existing "Vůně do auta" category, which every included item maps onto
// directly (no NEW: category needed, unlike the first two batches).
// Data collected the same way as the first two batches: scraping while
// logged in via a browser session — see
// scripts/tamda-data/tamda-autokosmetika-scrape.json.
//
// Usage:
//   npx tsx scripts/import-tamda-autokosmetika.ts --dry-run
//   npx tsx scripts/import-tamda-autokosmetika.ts --limit=20
//   npx tsx scripts/import-tamda-autokosmetika.ts
import { readFileSync } from "node:fs";
import { prisma } from "../src/lib/prisma";
import { downloadProductImages } from "../src/lib/import/download-images";
import { slugify } from "../src/lib/slug";

const DATA_PATH = "scripts/tamda-data/tamda-autokosmetika-scrape.json";
const DRY_RUN = process.argv.includes("--dry-run");
const LIMIT = Number(process.argv.find((a) => a.startsWith("--limit="))?.split("=")[1] ?? "0");
const CONCURRENCY = 6;
const DEFAULT_VAT_RATE = 21;
const CATEGORY_FULL_SLUG = "vune-do-auta";

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

// Checked against the existing DB brand list first at runtime
// (resolveBrandName below) — "Ambi Pur"/"AmbiPur" already exist from an
// earlier SPV import (kept as-is, not consolidated). These are the
// sub-lines that don't already match an existing brand name.
const NEW_BRAND_PREFIXES = ["Alexander the Salamander", "Mr Mrs Big Joy", "Mr&Mrs Jeff Chrome", "Power Air"];

function parseVatIncludedPrice(priceInclVat: number): { purchasePrice: number; sellPrice: number } {
  // Same conversion as the previous two Tamda batches: displayed prices
  // already include VAT, so strip it for our ex-VAT purchase basis, then
  // reapply the store's usual formula (purchase × 1.21 × 1.3) — the two
  // 1.21s cancel, leaving sellPrice = priceInclVat × 1.3.
  const purchasePrice = priceInclVat / 1.21;
  const sellPrice = Math.round(priceInclVat * 1.3);
  return { purchasePrice, sellPrice };
}

function parseStock(stockText: string | null): number {
  if (!stockText) return 0;
  const match = /Skladem\s+(>?)(\d+)ks/.exec(stockText);
  if (!match) return 0;
  const [, over, num] = match;
  return over ? 100 : parseInt(num, 10);
}

function resolveBrandName(name: string, existingBrandNames: string[]): string | null {
  const lower = name.toLowerCase();
  for (const brand of existingBrandNames) {
    const bl = brand.toLowerCase();
    if (lower === bl || lower.startsWith(bl + " ")) return brand;
  }
  for (const brand of NEW_BRAND_PREFIXES) {
    const bl = brand.toLowerCase();
    if (lower === bl || lower.startsWith(bl + " ")) return brand;
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
  const all = JSON.parse(readFileSync(DATA_PATH, "utf-8")) as RawItem[];
  console.log(`Parsed ${all.length} items`);

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

  const category = await prisma.category.findUnique({ where: { fullSlug: CATEGORY_FULL_SLUG } });
  if (!category) throw new Error(`Category fullSlug not found: ${CATEGORY_FULL_SLUG}`);

  const existingBrandNames = (await prisma.brand.findMany({ select: { name: true } }))
    .map((b) => b.name)
    .sort((a, b) => b.length - a.length);

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
        await prisma.productCategory.create({ data: { productId: product.id, categoryId: category.id } });
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
    if (processed % 20 === 0) {
      console.log(`  progress: ${processed}/${toProcess.length} (created=${created} updated=${updated} failed=${failed})`);
    }
  });

  console.log(`\nDone. Created: ${created}, Updated: ${updated}, Skipped (no price): ${skippedNoPrice}, Failed: ${failed}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
