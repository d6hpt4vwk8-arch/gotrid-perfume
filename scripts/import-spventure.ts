// One-off import for SP Venture (perfumes-b2b.com) product XML feed.
// Usage:
//   npx tsx scripts/import-spventure.ts --dry-run          (analysis only, no writes)
//   npx tsx scripts/import-spventure.ts --limit=20          (real run, capped)
//   npx tsx scripts/import-spventure.ts                     (real run, everything)
import { readFileSync } from "node:fs";
import { prisma } from "../src/lib/prisma";
import { downloadProductImages } from "../src/lib/import/download-images";
import { slugify } from "../src/lib/slug";

const XML_PATH = process.argv.find((a) => a.startsWith("--file="))?.split("=")[1]
  ?? "/Users/pavlogrican/Downloads/product (1).xml";
const DRY_RUN = process.argv.includes("--dry-run");
const LIMIT = Number(process.argv.find((a) => a.startsWith("--limit="))?.split("=")[1] ?? "0");
const CONCURRENCY = 6;

const DEFAULT_VAT_RATE = 21;

// Top-level branches we don't carry — not part of this store's assortment.
const SKIP_TOP = new Set(["LEGO®", "LEGO"]);
// Specific deeper branches to exclude even though their top-level is kept.
const SKIP_PATH_PREFIXES = ["BODY | Intimate hygiene", "Other | Zvířata"];

interface RawItem {
  itemCode: string;
  ean: string;
  productName: string;
  brand: string;
  category: string;
  img: string;
  stock: number;
  price: number;
}

function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'");
}

function extractTag(block: string, tag: string): string {
  const match = new RegExp(`<${tag}>([\\s\\S]*?)<\\/${tag}>`).exec(block);
  return match ? decodeEntities(match[1].trim()) : "";
}

function parseItems(xml: string): RawItem[] {
  const blocks = xml.split("<SHOPITEM>").slice(1);
  const items: RawItem[] = [];
  for (const raw of blocks) {
    const block = raw.split("</SHOPITEM>")[0];
    const stockRaw = extractTag(block, "STOCK");
    const priceRaw = extractTag(block, "PRICE");
    items.push({
      itemCode: extractTag(block, "ITEM_CODE"),
      ean: extractTag(block, "EAN"),
      productName: extractTag(block, "PRODUCTNAME"),
      brand: extractTag(block, "BRAND"),
      category: extractTag(block, "CATEGORY"),
      img: extractTag(block, "IMG"),
      stock: stockRaw ? parseInt(stockRaw, 10) : 0,
      price: priceRaw ? parseFloat(priceRaw) : 0,
    });
  }
  return items;
}

function isSkipped(category: string): boolean {
  const top = category.split("|")[0].trim();
  if (SKIP_TOP.has(top)) return true;
  return SKIP_PATH_PREFIXES.some((prefix) => category.startsWith(prefix));
}

// Maps SP Venture's English category path onto this store's existing (Czech)
// category tree by fullSlug — reuses categories instead of growing a
// parallel English-named tree. `null` value means "attach at this existing
// category directly" (no better leaf match); a string starting with "NEW:"
// creates a small missing leaf under an existing parent.
const CATEGORY_MAP: Record<string, string> = {
  "PERFUMES | Women's perfumes | Eau de perfumes": "parfemy/damske-parfemy/parfemovane-vody",
  "PERFUMES | Women's perfumes | Eau de toilettes": "parfemy/damske-parfemy/toaletni-vody",
  "PERFUMES | Women's perfumes | Niche perfumes": "parfemy/damske-parfemy",
  "PERFUMES | Women's perfumes | Gift sets": "parfemy/darkove-sady",
  "PERFUMES | Women's perfumes | Perfume testers": "parfemy/damske-parfemy",
  "PERFUMES | Women's perfumes": "parfemy/damske-parfemy",
  "PERFUMES | Men's perfumes  | Eau de perfumes": "parfemy/panske-parfemy/parfemovane-vody",
  "PERFUMES | Men's perfumes  | Eau de toilettes": "parfemy/panske-parfemy/toaletni-vody",
  "PERFUMES | Men's perfumes  | Niche perfumes": "parfemy/panske-parfemy",
  "PERFUMES | Men's perfumes  | Gift sets": "parfemy/darkove-sady",
  "PERFUMES | Men's perfumes  | Eau de colognes": "parfemy/panske-parfemy",
  "PERFUMES | Men's perfumes  | Perfume testers": "parfemy/panske-parfemy",
  "PERFUMES | Men's perfumes ": "parfemy/panske-parfemy",
  "PERFUMES | Unisex perfumes | Eau de perfumes": "parfemy/unisex-parfemy/parfemovane-vody",
  "PERFUMES | Unisex perfumes | Eau de toilettes": "parfemy/unisex-parfemy/toaletni-vody",
  "PERFUMES | Unisex perfumes | Niche perfumes": "parfemy/unisex-parfemy",
  "PERFUMES | Unisex perfumes | Gift sets": "parfemy/darkove-sady",
  "PERFUMES | Unisex perfumes": "parfemy/unisex-parfemy",
  "PERFUMES | Car and house perfumes | Scented candles": "vonne-svicky",
  "PERFUMES | Car and house perfumes | Car perfumes": "vune-do-auta",
  "PERFUMES | Car and house perfumes | Home freshener sprays and diffusers": "aroma-difuzery",
  "PERFUMES | Car and house perfumes": "domacnost",
  PERFUMES: "parfemy",

  "HAIR | Hair care | Shampoos": "kosmetika/vlasy/sampony",
  "HAIR | Hair care | Conditioners": "kosmetika/vlasy/kondicionery-a-balzamy",
  "HAIR | Hair care | Conditioners ": "kosmetika/vlasy/kondicionery-a-balzamy",
  "HAIR | Hair care | Hair masks": "kosmetika/vlasy/vlasove-masky",
  "HAIR | Hair care | Leave-in hair care": "kosmetika/vlasy/vlasova-sera",
  "HAIR | Hair care | Hair oils": "kosmetika/vlasy/vlasova-sera",
  "HAIR | Hair care | Hair balms ": "kosmetika/vlasy/kondicionery-a-balzamy",
  "HAIR | Hair care": "kosmetika/vlasy",
  "HAIR | Styling | Hairsprays": "kosmetika/vlasy/styling",
  "HAIR | Styling | Hair sprays": "kosmetika/vlasy/styling",
  "HAIR | Styling | Hair creams": "kosmetika/vlasy/styling",
  "HAIR | Styling | Hair pomades for men": "kosmetika/vlasy/styling",
  "HAIR | Styling | Hair foams": "kosmetika/vlasy/styling",
  "HAIR | Styling | Hair waxes": "kosmetika/vlasy/styling",
  "HAIR | Styling | Hair gels": "kosmetika/vlasy/styling",
  "HAIR | Styling | Hair mousses": "kosmetika/vlasy/styling",
  "HAIR | Styling": "kosmetika/vlasy/styling",
  "HAIR | Hair styling tools and accessories | Combs and brushes": "NEW:kosmetika/vlasy>Doplňky",
  "HAIR | Hair styling tools and accessories | Rubber bands and hairclips": "NEW:kosmetika/vlasy>Doplňky",
  "HAIR | Hair styling tools and accessories | Hair towels": "NEW:kosmetika/vlasy>Doplňky",
  "HAIR | Hair styling tools and accessories | Hair dryers": "NEW:kosmetika/vlasy>Doplňky",
  "HAIR | Hair styling tools and accessories": "NEW:kosmetika/vlasy>Doplňky",
  "HAIR | Hairdresser accessories": "NEW:kosmetika/vlasy>Doplňky",
  "HAIR | Hair colouring | Hair correctors": "kosmetika/vlasy",
  "HAIR | Gift sets": "kosmetika/vlasy",
  HAIR: "kosmetika/vlasy",

  "BODY | Deosprays | Deodorants": "kosmetika/telo/deodoranty",
  "BODY | Deosprays | Antiperspirants": "kosmetika/telo/deodoranty",
  "BODY | Bath&amp;Shower cosmetics | Shower gels": "kosmetika/sprchove-gely",
  "BODY | Bath&amp;Shower cosmetics | Liquid soaps": "kosmetika/telo/mydla",
  "BODY | Bath&amp;Shower cosmetics | Solid soaps": "kosmetika/telo/mydla",
  "BODY | Bath&amp;Shower cosmetics": "kosmetika/telo/sprcha-a-koupel",
  "BODY | Sunbathing | Sunscreen lotions": "kosmetika/telo/opalovaci-kosmetika",
  "BODY | Sunbathing | After-sun lotions": "kosmetika/telo/opalovaci-kosmetika",
  "BODY | Sunbathing | Self-Tanners": "kosmetika/telo/opalovaci-kosmetika",
  "BODY | Sunbathing": "kosmetika/telo/opalovaci-kosmetika",
  "BODY | Body care | Body lotions": "kosmetika/telo/telova-mleka",
  "BODY | Body care | Body creams": "kosmetika/telo/telova-mleka",
  "BODY | Body care | Body sprays": "kosmetika/telo",
  "BODY | Body care | Body oils": "kosmetika/telove-oleje",
  "BODY | Body care | Body balms": "kosmetika/telo/telova-mleka",
  "BODY | Body care | Body butters": "kosmetika/telove-oleje",
  "BODY | Body care": "kosmetika/telo",
  "BODY | Oral&amp;Dental hygiene | Toothpastes": "zuby/zubni-pasty",
  "BODY | Oral&amp;Dental hygiene | Toothbrushes": "zuby/zubni-kartacky",
  "BODY | Oral&amp;Dental hygiene | Interdental care": "zuby/zubni-nite",
  "BODY | Oral&amp;Dental hygiene | Mouthwashes": "zuby/ustni-vody",
  "BODY | Oral&amp;Dental hygiene | Special treatment": "zuby/doplnky-k-cisteni-zubu",
  "BODY | Oral&amp;Dental hygiene | sets": "zuby/doplnky-k-cisteni-zubu",
  "BODY | Oral&amp;Dental hygiene": "zuby",
  "BODY | Hand and foot care | Hand creams": "kosmetika/telo/krem-na-ruce",
  "BODY | Hand and foot care | Pedicure tools and accessories": "kosmetika/telo",
  "BODY | Hand and foot care | Foot masks and creams": "kosmetika/telo/krem-na-ruce",
  "BODY | Hand and foot care": "kosmetika/telo/krem-na-ruce",
  "BODY | Shaving | After shave balms": "kosmetika/telo/depilace",
  "BODY | Shaving | After shave lotions": "kosmetika/telo/depilace",
  "BODY | Shaving | Spare razor blades": "kosmetika/telo/depilace",
  "BODY | Shaving | Razors": "kosmetika/telo/depilace",
  "BODY | Shaving | Shaving gels": "kosmetika/telo/depilace",
  "BODY | Shaving | Shaving foams": "kosmetika/telo/depilace",
  "BODY | Shaving | Pre-shave creams": "kosmetika/telo/depilace",
  "BODY | Shaving": "kosmetika/telo/depilace",
  "BODY | Gift sets": "kosmetika/telo",
  "BODY | Againts cellulite&amp;Stretch marks": "kosmetika/telo",
  "BODY | {Masážní přípravky}": "kosmetika/telo",
  BODY: "kosmetika/telo",

  "SKIN | Skin care | Day creams": "kosmetika/plet/pletove-kremy",
  "SKIN | Skin care | Night creams": "kosmetika/plet/pletove-kremy",
  "SKIN | Skin care | Face serums": "kosmetika/plet/pletova-sera",
  "SKIN | Skin care | Face gels": "kosmetika/plet/pletove-kremy",
  "SKIN | Skin care | Face oils": "kosmetika/plet/pletove-kremy",
  "SKIN | Skin care | Face mists": "kosmetika/plet/pletove-kremy",
  "SKIN | Skin care | Spot treatment": "kosmetika/plet/pletove-kremy",
  "SKIN | Skin care": "kosmetika/plet",
  "SKIN | Skin cleansing | Cleansing milks and tonics": "kosmetika/plet/cisteni-pleti",
  "SKIN | Skin cleansing | Cleansing gels": "kosmetika/plet/cisteni-pleti",
  "SKIN | Skin cleansing | Cleansing foams": "kosmetika/plet/cisteni-pleti",
  "SKIN | Skin cleansing | Cleansing oils": "kosmetika/plet/cisteni-pleti",
  "SKIN | Skin cleansing | Cleansing creams": "kosmetika/plet/cisteni-pleti",
  "SKIN | Skin cleansing | Micellar waters": "kosmetika/plet/cisteni-pleti",
  "SKIN | Skin cleansing | Eye makeup removers": "kosmetika/plet/cisteni-pleti",
  "SKIN | Skin cleansing | Cleansing skin soaps": "kosmetika/plet/cisteni-pleti",
  "SKIN | Skin cleansing": "kosmetika/plet/cisteni-pleti",
  "SKIN | Face masks and exfoliators | Cream and gel masks": "kosmetika/plet/pletove-masky",
  "SKIN | Face masks and exfoliators | Facial exfoliators": "kosmetika/plet/pletove-peelingy",
  "SKIN | Face masks and exfoliators | Textile face masks": "kosmetika/plet/pletove-masky",
  "SKIN | Eye care | Eye creams": "kosmetika/plet/pletove-kremy",
  "SKIN | Eye care | Eye gels": "kosmetika/plet/pletove-kremy",
  "SKIN | Eye care | Eye serums": "kosmetika/plet/pletova-sera",
  "SKIN | Eye care | GLASSES": "kosmetika/plet/pletove-kremy",
  "SKIN | Beard care": "kosmetika/telo",
  "SKIN | Gift sets": "kosmetika/plet",
  SKIN: "kosmetika/plet",

  "MAKEUP | Face | Foundations": "kosmetika/dekorativni-kosmetika",
  "MAKEUP | Face | Powders": "kosmetika/dekorativni-kosmetika",
  "MAKEUP | Face | BB, CC and DD creams": "kosmetika/dekorativni-kosmetika",
  "MAKEUP | Face | Concealers": "kosmetika/dekorativni-kosmetika",
  "MAKEUP | Face | Blushes": "kosmetika/dekorativni-kosmetika",
  "MAKEUP | Face | Highlighters": "kosmetika/dekorativni-kosmetika",
  "MAKEUP | Face | Makeup primers": "kosmetika/dekorativni-kosmetika",
  "MAKEUP | Eyes | Mascaras": "kosmetika/dekorativni-kosmetika/oci",
  "MAKEUP | Eyes | Eye pencils": "kosmetika/dekorativni-kosmetika/oci",
  "MAKEUP | Eyes | Eyeliners": "kosmetika/dekorativni-kosmetika/oci",
  "MAKEUP | Eyebrows | Eyebrow dye": "kosmetika/dekorativni-kosmetika/oci",
  "MAKEUP | Eyebrows | Eyebrow gels and pomades": "kosmetika/dekorativni-kosmetika/oci",
  "MAKEUP | Eyebrows | Eyebrow pencils": "kosmetika/dekorativni-kosmetika/oci",
  "MAKEUP | Eyebrows | Eyebrow sets": "kosmetika/dekorativni-kosmetika/oci",
  "MAKEUP | Lips | Lipsticks": "kosmetika/dekorativni-kosmetika/rty",
  "MAKEUP | Lips | Lip balms": "kosmetika/dekorativni-kosmetika/rty",
  "MAKEUP | Lips | Lip glosses": "kosmetika/dekorativni-kosmetika/rty",
  "MAKEUP | Lips | Lip liners": "kosmetika/dekorativni-kosmetika/rty",
  "MAKEUP | Nails | Tools and accessories ": "kosmetika/dekorativni-kosmetika",
  "MAKEUP | Cosmetics brushes": "kosmetika/dekorativni-kosmetika",
  "MAKEUP | Accessories": "kosmetika/dekorativni-kosmetika",
  MAKEUP: "kosmetika/dekorativni-kosmetika",

  "Other | KIDS": "kosmetika",
  "Other | KIDS | Šampony a potřeby do koupele": "kosmetika/vlasy/sampony",
  "Other | KIDS | Tělové krémy, mléka a oleje": "kosmetika/telo/telova-mleka",
  "Other | KIDS | {BIO / přírodní}": "kosmetika",
  "Other | KIDS | Péče o vlásky": "kosmetika/vlasy",
  "Other | ORGANIC | Skin": "kosmetika/plet",
  Other: "kosmetika",
};

function resolveCategoryTarget(category: string): { fullSlug?: string; newPath?: string } {
  const mapped = CATEGORY_MAP[category];
  if (mapped) {
    if (mapped.startsWith("NEW:")) {
      const [parentSlug, childName] = mapped.slice(4).split(">");
      return { newPath: `${parentSlug}::${childName}` };
    }
    return { fullSlug: mapped };
  }
  // Unmapped path: fall back to the top-level branch's existing category.
  const top = category.split("|")[0].trim();
  const topFallback: Record<string, string> = {
    PERFUMES: "parfemy",
    HAIR: "kosmetika/vlasy",
    BODY: "kosmetika/telo",
    SKIN: "kosmetika/plet",
    MAKEUP: "kosmetika/dekorativni-kosmetika",
    Other: "kosmetika",
  };
  return { fullSlug: topFallback[top] ?? "kosmetika" };
}

const PERFUME_MARKERS = /\b(EDP|EDT|EDC|parf[ée]m|toaletn[íi] voda|cologne|parf[ée]movan[áa])\b/i;

function resolveNoveCategory(productName: string): { fullSlug?: string; newPath?: string } {
  return PERFUME_MARKERS.test(productName) ? { fullSlug: "parfemy" } : { fullSlug: "kosmetika" };
}

async function getOrCreateCategoryId(
  cache: Map<string, string>,
  target: { fullSlug?: string; newPath?: string },
): Promise<string | null> {
  if (target.fullSlug) {
    if (cache.has(target.fullSlug)) return cache.get(target.fullSlug)!;
    const cat = await prisma.category.findUnique({ where: { fullSlug: target.fullSlug } });
    if (!cat) {
      console.warn(`  [warn] category fullSlug not found: ${target.fullSlug}, skipping category assignment`);
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
    const created = await prisma.category.upsert({
      where: { fullSlug },
      update: {},
      create: { name: childName, slug: childSlug, fullSlug, parentId: parent.id },
    });
    cache.set(target.newPath, created.id);
    return created.id;
  }
  return null;
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
    // Concurrent batch created the same brand between our check and insert —
    // upsert's ON CONFLICT targets `slug`, but `name` is unique too, so a
    // same-brand race can still throw. Just read back what the other call wrote.
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
  const xml = readFileSync(XML_PATH, "utf-8");
  const all = parseItems(xml);
  console.log(`Parsed ${all.length} items`);

  const relevant = all.filter((item) => !isSkipped(item.category));
  console.log(`After category exclusions: ${relevant.length}`);

  const byEan = new Map<string, RawItem>();
  for (const item of relevant) {
    if (!item.ean) continue;
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
  console.log(`Will process: ${toProcess.length} (new: ${toProcess.filter((i) => !existingByEan.has(i.ean)).length}, update: ${toProcess.filter((i) => existingByEan.has(i.ean)).length})`);

  if (DRY_RUN) {
    console.log("Dry run — stopping before any writes.");
    return;
  }

  const categoryCache = new Map<string, string>();
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
        const categoryTarget = item.category === "Nové"
          ? resolveNoveCategory(item.productName)
          : resolveCategoryTarget(item.category);
        const categoryId = await getOrCreateCategoryId(categoryCache, categoryTarget);
        const brandId = await resolveBrandId(brandCache, item.brand);

        const code = `SPV-${item.itemCode}`;
        const slug = `${slugify(item.productName)}-${code.toLowerCase()}`;

        const { urls: imageUrls } = item.img
          ? await downloadProductImages(code, item.img)
          : { urls: [] };

        const product = await prisma.product.create({
          data: {
            name: item.productName,
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
      console.error(`  [error] EAN ${item.ean} (${item.productName}):`, err instanceof Error ? err.message : err);
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
