// One-off import for GVS Cosmetics (Czech distributor of Korean skincare/
// haircare brands) — a 4-tab Google Sheets wholesale price list shared by
// the user as an XLSX export. Each tab is a different brand; the "Photo"
// column holds images pasted directly into cells (not URLs), which only
// survive an XLSX export (not CSV) and needed pulling out of the file's
// drawing XML by hand — see scripts/gvs-data/data.json, produced by a
// one-off Python extraction pass (data + row->image-filename mapping) and
// scripts/gvs-data/media/ (the extracted image files themselves).
//
// Usage:
//   npx tsx scripts/import-gvs-cosmetics.ts --dry-run
//   npx tsx scripts/import-gvs-cosmetics.ts
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { prisma } from "../src/lib/prisma";
import { slugify } from "../src/lib/slug";

const DATA_DIR = path.join(process.cwd(), "scripts", "gvs-data");
const DRY_RUN = process.argv.includes("--dry-run");
const DEFAULT_VAT_RATE = 21;

interface RawRow {
  row: number;
  ean: string;
  article: string | null;
  name: string;
  avail: string | null;
  price: number | null;
  rrp: number | null;
  image_file: string | null;
}

const BRAND_BY_SHEET: Record<string, string> = {
  "Dr. Althea": "Dr. Althea",
  "Esthetic House": "Esthetic House",
  VVBETTER: "VVBETTER",
  Polatam: "Polatam",
};

function resolveBrand(sheet: string, name: string): string {
  if (/freemoment/i.test(name)) return "FREEMOMENT";
  return BRAND_BY_SHEET[sheet];
}

// Keyword classifier shared across all 4 brand tabs — GVS's catalog is
// almost entirely Korean skincare with a handful of haircare items mixed
// into the "Dr. Althea"/"Esthetic House" tabs, so per-item name matching is
// more reliable than a per-sheet default.
function classifyCategory(name: string): string {
  const n = name.toLowerCase();
  if (/hair mask/.test(n)) return "kosmetika/vlasy/vlasove-masky";
  if (/\bshampoo\b/.test(n)) return "kosmetika/vlasy/sampony";
  if (/\bconditioner\b/.test(n)) return "kosmetika/vlasy/kondicionery-a-balzamy";
  if (/scalp scaler|scalp refresh/.test(n)) return "kosmetika/vlasy/vlasova-tonika";
  if (/keratin concentrate|hair fill-up|premium silk ampoule|premium hair treatment|perfume treatment|head spa peeling ampoule/.test(n)) return "kosmetika/vlasy/vlasova-sera";

  if (/primer|finishing powder|\bblur\b/.test(n)) return "kosmetika/dekorativni-kosmetika/tvar";
  if (/sunscreen/.test(n)) return "kosmetika/telo/opalovaci-kosmetika";
  if (/sponge|_pouch\b|\bpouch\b/.test(n)) return "kosmetika/telo/doplnky";
  if (/travel kit/.test(n)) return "kosmetika/telo/darkove-sady";

  if (/cleansing|cleanser|bubble cleanser/.test(n)) return "kosmetika/plet/cisteni-pleti";
  if (/\btoner\b|\bpad\b|fit pad/.test(n)) return "kosmetika/plet/cisteni-pleti";
  if (/\bmask\b/.test(n)) return "kosmetika/plet/pletove-masky";
  if (/serum|essence|ampoule/.test(n)) return "kosmetika/plet/pletova-sera";
  return "kosmetika/plet/pletove-kremy"; // creams, eye rollers, balms default
}

async function copyLocalProductImage(productCode: string, sourceFileName: string): Promise<string | null> {
  const sourcePath = path.join(DATA_DIR, "media", sourceFileName);
  const ext = path.extname(sourceFileName).replace(".", "") || "jpg";
  const dir = path.join(process.cwd(), "public", "uploads", "products", encodeURIComponent(productCode));
  await mkdir(dir, { recursive: true });
  const hash = createHash("sha1").update(sourceFileName + productCode).digest("hex").slice(0, 12);
  const filename = `${hash}-0.${ext}`;
  const destPath = path.join(dir, filename);
  try {
    const buf = await readFile(sourcePath);
    await writeFile(destPath, buf);
    return `/uploads/products/${encodeURIComponent(productCode)}/${filename}`;
  } catch {
    return null;
  }
}

async function getOrCreateCategoryId(cache: Map<string, string>, fullSlug: string): Promise<string | null> {
  if (cache.has(fullSlug)) return cache.get(fullSlug)!;
  const cat = await prisma.category.findUnique({ where: { fullSlug } });
  if (!cat) {
    console.warn(`  [warn] category not found: ${fullSlug}`);
    return null;
  }
  cache.set(fullSlug, cat.id);
  return cat.id;
}

async function resolveBrandId(cache: Map<string, string>, brandName: string): Promise<string> {
  const slug = slugify(brandName);
  if (cache.has(slug)) return cache.get(slug)!;
  try {
    const brand = await prisma.brand.upsert({ where: { slug }, update: {}, create: { name: brandName, slug } });
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

interface Item extends RawRow {
  sheet: string;
  brand: string;
  categorySlug: string;
}

async function main() {
  const raw = JSON.parse(await readFile(path.join(DATA_DIR, "data.json"), "utf-8")) as Record<string, RawRow[]>;

  const all: Item[] = [];
  let skippedCombo = 0;
  let skippedNoData = 0;
  for (const [sheet, rows] of Object.entries(raw)) {
    for (const r of rows) {
      if (!r.ean || !r.name || r.price === null) {
        skippedNoData++;
        continue;
      }
      if (r.ean.includes("\n")) {
        // Combo/bundle row (EAN cell lists two SKUs together) — the two
        // constituent products are already imported as their own rows.
        skippedCombo++;
        continue;
      }
      all.push({
        ...r,
        ean: r.ean.trim(),
        sheet,
        brand: resolveBrand(sheet, r.name),
        categorySlug: classifyCategory(r.name),
      });
    }
  }
  console.log(`Parsed ${all.length} items (skipped ${skippedCombo} combo rows, ${skippedNoData} incomplete rows)`);

  // Dedupe by EAN: keep the lowest price, but guard against the kind of
  // data-entry typo found during review (one row priced at 0.90 Kč while
  // its own bulk-discount tier column showed ~22 Kč — a price a fifth of
  // the group's other value is almost certainly a fat-fingered digit, not
  // a real discount).
  const byEan = new Map<string, Item[]>();
  for (const item of all) {
    const group = byEan.get(item.ean) ?? [];
    group.push(item);
    byEan.set(item.ean, group);
  }
  const deduped: Item[] = [];
  for (const group of byEan.values()) {
    const maxPrice = Math.max(...group.map((g) => g.price!));
    const plausible = group.filter((g) => g.price! >= maxPrice * 0.2);
    plausible.sort((a, b) => a.price! - b.price!);
    deduped.push(plausible[0]);
  }
  console.log(`Unique by EAN: ${deduped.length}`);

  const eans = deduped.map((d) => d.ean);
  const existingProducts = await prisma.product.findMany({
    where: { ean: { in: eans } },
    select: { id: true, ean: true, price: true },
  });
  const existingByEan = new Map(existingProducts.map((p) => [p.ean!, p]));
  console.log(
    `New: ${deduped.filter((d) => !existingByEan.has(d.ean)).length}, update: ${deduped.filter((d) => existingByEan.has(d.ean)).length}`,
  );

  if (DRY_RUN) {
    console.log("Dry run — stopping before any writes.");
    for (const item of deduped.slice(0, 10)) {
      console.log(`  ${item.ean} | ${item.brand} | ${item.name} -> ${item.categorySlug} (price=${item.price})`);
    }
    return;
  }

  const categoryCache = new Map<string, string>();
  const brandCache = new Map<string, string>();
  let created = 0;
  let updated = 0;
  let failed = 0;

  for (const item of deduped) {
    try {
      const purchasePrice = item.price!; // user-confirmed: ex-VAT, same basis as SP Venture
      const sellPrice = Math.round(purchasePrice * 1.21 * 1.2);
      const stock = item.avail === "in stock" ? 10 : 0; // no numeric stock in this price list, just availability
      const existing = existingByEan.get(item.ean);

      if (existing) {
        if (sellPrice < Number(existing.price)) {
          await prisma.product.update({ where: { id: existing.id }, data: { price: sellPrice, purchasePrice, stock } });
        } else {
          await prisma.product.update({ where: { id: existing.id }, data: { stock } });
        }
        updated++;
        continue;
      }

      const categoryId = await getOrCreateCategoryId(categoryCache, item.categorySlug);
      const brandId = await resolveBrandId(brandCache, item.brand);
      const code = `GVS-${item.article ?? item.ean}`;
      const slug = `${slugify(item.name)}-${code.toLowerCase()}`;
      const imageUrl = item.image_file ? await copyLocalProductImage(code, item.image_file) : null;

      const product = await prisma.product.create({
        data: {
          name: item.name,
          code,
          slug,
          ean: item.ean,
          brandId,
          price: sellPrice,
          purchasePrice,
          vatRate: DEFAULT_VAT_RATE,
          stock,
          visible: Boolean(imageUrl),
        },
      });
      if (categoryId) {
        await prisma.productCategory.create({ data: { productId: product.id, categoryId } });
      }
      if (imageUrl) {
        await prisma.productImage.create({ data: { productId: product.id, url: imageUrl, sortOrder: 0 } });
      }
      created++;
    } catch (err) {
      failed++;
      console.error(`  [error] EAN ${item.ean} (${item.name}):`, err instanceof Error ? err.message : err);
    }
  }

  console.log(`\nDone. Created: ${created}, Updated: ${updated}, Failed: ${failed}`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
