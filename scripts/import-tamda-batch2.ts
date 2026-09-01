// Second Tamda Express batch — 5 additional on-concept categories approved
// by the owner after the first import (hair care, shaving, feminine/intimate
// care, nail care, scented candles only — explicitly excluding laundry
// detergent, household cleaners, and other non-cosmetics Drogerie branches).
// Data collected the same way as the first batch: scraping while logged in
// via a browser session — see scripts/tamda-data/tamda-new-categories-scrape.json.
//
// Usage:
//   npx tsx scripts/import-tamda-batch2.ts --dry-run
//   npx tsx scripts/import-tamda-batch2.ts --limit=20
//   npx tsx scripts/import-tamda-batch2.ts
import { readFileSync } from "node:fs";
import { prisma } from "../src/lib/prisma";
import { downloadProductImages } from "../src/lib/import/download-images";
import { slugify } from "../src/lib/slug";

const DATA_PATH = "scripts/tamda-data/tamda-new-categories-scrape.json";
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

// Direct/simple mappings onto the existing category tree by fullSlug.
// "Masky a oleje na vlasy" is handled separately (resolveHairTreatmentCategory)
// since Tamda lumps masks/serums/toners into one bucket that we already split
// three ways. All 4 shaving subcategories collapse onto the single existing
// "Depilace" leaf, same as SP Venture's convention.
const CATEGORY_MAP: Record<string, string> = {
  Kondicionéry: "kosmetika/vlasy/kondicionery-a-balzamy",
  "Gely na vlasy": "kosmetika/vlasy/styling",
  Šampony: "kosmetika/vlasy/sampony",
  "Voda po holení": "kosmetika/telo/depilace",
  "Depilační": "kosmetika/telo/depilace",
  "Gel na holení": "kosmetika/telo/depilace",
  "Holící břitvy": "kosmetika/telo/depilace",
  "Vonné svíčky": "vonne-svicky",
  "Barvy na vlasy": "NEW:kosmetika/vlasy>Barvy na vlasy",
  // "Čistící voda" is actually facial micellar water / makeup-remover pads
  // (Nivea, Astrid, Bella odličovací tampony…), not intimate hygiene despite
  // sitting in the same Tamda parent bucket as the two categories below —
  // verified by reading the actual product names before mapping.
  "Čistící voda": "kosmetika/plet/cisteni-pleti",
  "Dámské vložky": "NEW:kosmetika/telo>Intimní hygiena",
  "Intimní péče": "NEW:kosmetika/telo>Intimní hygiena",
  "Péče o nehty": "NEW:kosmetika/dekorativni-kosmetika>Nehty",
};

const HAIR_SERUM_MARKER = /serum|sérum/i;
const HAIR_TONER_MARKER = /toner/i;

function resolveHairTreatmentCategory(name: string): string {
  if (HAIR_SERUM_MARKER.test(name)) return "kosmetika/vlasy/vlasova-sera";
  if (HAIR_TONER_MARKER.test(name)) return "kosmetika/vlasy/vlasova-tonika";
  return "kosmetika/vlasy/vlasove-masky";
}

function resolveCategoryTarget(item: RawItem): { fullSlug?: string; newPath?: string } {
  if (item.category === "Masky a oleje na vlasy") {
    return { fullSlug: resolveHairTreatmentCategory(item.name) };
  }
  const mapped = CATEGORY_MAP[item.category];
  if (!mapped) return { fullSlug: "kosmetika" };
  if (mapped.startsWith("NEW:")) {
    const [parentSlug, childName] = mapped.slice(4).split(">");
    return { newPath: `${parentSlug}::${childName}` };
  }
  return { fullSlug: mapped };
}

// Curated from a manual pass over this batch's 565 product names — same
// approach as scripts/import-tamda.ts's KNOWN_BRAND_PREFIXES. Checked against
// the existing DB brand list first at runtime (resolveBrandName below), so
// entries already covered there (Adidas, Gillette, Loreal, Herbavera, Mattes,
// Dermomed, Naturalis, Arôme, Atlantic, Milmil, Amia, Organic Shop, Chopa,
// Laura, Playboy…) aren't repeated here. Longer/multi-word entries first.
const NEW_BRAND_PREFIXES = [
  "Savon De Royal",
  "Herbal Essences",
  "Revolution Haircare",
  "Maxx Deluxe",
  "Gillette Venus",
  "Air wick",
  "Air Wick",
  "Always",
  "Palette",
  "Gliss",
  "Bartek",
  "Pantene",
  "Taft",
  "Nivea",
  "Fructis",
  "Syoss",
  "Chilly",
  "Lactacyd",
  "Alpecin",
  "Bella",
  "Lybar",
  "Schauma",
  "Multicolor",
  "Multi Blond",
  "Wellaflex",
  "Astrid",
  "Linteo",
  "Gudlox",
  "Got2b",
  "Strep",
  "GoodMax",
  "Wilkinson",
  "Plantur",
  "SUNDAY",
  "Bel",
  "Valea",
  "Naturia",
  "XHC",
  "Bispol",
  "Joanna",
  "Venus",
  "Arome",
];

function parseVatIncludedPrice(priceInclVat: number): { purchasePrice: number; sellPrice: number } {
  // Same conversion as the first Tamda batch: displayed prices already
  // include VAT, so strip it for our ex-VAT purchase basis, then reapply the
  // store's usual formula (purchase × 1.21 × 1.3) — the two 1.21s cancel.
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

  const categoryTally = new Map<string, number>();
  for (const item of toProcess) {
    const target = resolveCategoryTarget(item);
    const key = target.fullSlug ?? target.newPath ?? "?";
    categoryTally.set(key, (categoryTally.get(key) ?? 0) + 1);
  }
  console.log("Category breakdown:", Object.fromEntries(categoryTally));

  if (DRY_RUN) {
    console.log("Dry run — stopping before any writes.");
    return;
  }

  const existingBrandNames = (await prisma.brand.findMany({ select: { name: true } }))
    .map((b) => b.name)
    .sort((a, b) => b.length - a.length);

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

  await prisma.adminActivityLog.create({
    data: {
      action: "product.bulk_import",
      entityType: "product",
      detail: `Druhá dávka importu od dodavatele Tamda Express (péče o vlasy, holení, intimní hygiena, péče o nehty, vonné svíčky): vytvořeno ${created}, aktualizováno ${updated}, chyby ${failed}.`,
    },
  });
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
