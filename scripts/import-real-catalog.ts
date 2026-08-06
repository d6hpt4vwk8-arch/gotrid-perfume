import { readFile, writeFile } from "node:fs/promises";
import { prisma } from "../src/lib/prisma";
import { slugify } from "../src/lib/slug";
import { resolveCategoryPath } from "../src/lib/import/resolve-category";
import { downloadProductImages } from "../src/lib/import/download-images";
import { parseDecimal } from "../src/lib/import/parse-number";

const CATALOG_JSON =
  "/private/tmp/claude-501/-Users-pavlogrican-Desktop-Gotrid-Perfume-co-work-Claude/dc2b2472-4ca7-4d2b-afd1-7ef24eb3a407/scratchpad/catalog.json";

// Zboží.cz feeds don't carry exact stock counts (only VISIBILITY=1/0) — this
// placeholder marks everything as modestly in stock. TZ §6.2's real XLSX
// admin export (code/stock columns) is the source of truth for exact
// quantities; re-import from there once available to correct this.
const PLACEHOLDER_STOCK = 5;

interface CatalogRecord {
  itemId: string;
  name: string;
  description: string | null;
  price: string;
  compareAtPrice: string | null;
  ean: string | null;
  manufacturer: string | null;
  categoryText: string;
  images: string[];
  oldUrl: string;
  oldSlug: string;
}

async function resolveBrandId(name: string | null): Promise<string | null> {
  if (!name?.trim()) return null;
  const slug = slugify(name);
  const brand = await prisma.brand.upsert({
    where: { slug },
    update: {},
    create: { name: name.trim(), slug },
  });
  return brand.id;
}

async function main() {
  const raw = await readFile(CATALOG_JSON, "utf-8");
  const records: CatalogRecord[] = JSON.parse(raw);

  let created = 0;
  let updated = 0;
  const errors: { itemId: string; message: string }[] = [];
  const redirects: { source: string; destination: string }[] = [];

  for (const [index, record] of records.entries()) {
    try {
      const price = parseDecimal(record.price);
      if (price === null) {
        errors.push({ itemId: record.itemId, message: `Neplatná cena "${record.price}"` });
        continue;
      }

      const brandId = await resolveBrandId(record.manufacturer);
      const categoryId = await resolveCategoryPath(prisma, record.categoryText);
      const { urls: imageUrls, errors: imageErrors } = await downloadProductImages(
        record.itemId,
        record.images.join(","),
      );
      for (const imgErr of imageErrors) {
        errors.push({ itemId: record.itemId, message: `Varování obrázku: ${imgErr}` });
      }

      const existing = await prisma.product.findUnique({
        where: { code: record.itemId },
        select: { id: true },
      });

      const compareAtPrice = record.compareAtPrice ? parseDecimal(record.compareAtPrice) : null;

      await prisma.$transaction(async (tx) => {
        const product = await tx.product.upsert({
          where: { code: record.itemId },
          update: {
            name: record.name,
            ean: record.ean,
            brandId,
            price,
            compareAtPrice,
            description: record.description ? `<p>${record.description}</p>` : null,
          },
          create: {
            code: record.itemId,
            name: record.name,
            slug: record.oldSlug,
            ean: record.ean,
            brandId,
            purchasePrice: 0,
            price,
            compareAtPrice,
            vatRate: 21,
            description: record.description ? `<p>${record.description}</p>` : null,
            stock: PLACEHOLDER_STOCK,
          },
        });

        if (categoryId) {
          await tx.productCategory.deleteMany({ where: { productId: product.id } });
          await tx.productCategory.create({ data: { productId: product.id, categoryId } });
        }

        if (imageUrls.length > 0) {
          await tx.productImage.deleteMany({ where: { productId: product.id } });
          await tx.productImage.createMany({
            data: imageUrls.map((url, i) => ({ productId: product.id, url, sortOrder: i })),
          });
        }
      });

      if (existing) updated++;
      else created++;

      redirects.push({
        source: `/${record.oldSlug}/`,
        destination: `/produkt/${record.oldSlug}`,
      });

      if ((index + 1) % 50 === 0) {
        console.log(`... ${index + 1}/${records.length}`);
      }
    } catch (err) {
      errors.push({
        itemId: record.itemId,
        message: err instanceof Error ? err.message : "Neznámá chyba",
      });
    }
  }

  await writeFile(
    "src/lib/redirects/product-redirects.json",
    JSON.stringify(redirects, null, 2),
  );

  console.log(`\nVytvořeno: ${created}`);
  console.log(`Aktualizováno: ${updated}`);
  console.log(`Chyby/varování: ${errors.length}`);
  for (const err of errors.slice(0, 30)) {
    console.log(`  ${err.itemId}: ${err.message}`);
  }
  if (errors.length > 30) console.log(`  ... a dalších ${errors.length - 30}`);
  console.log(`\nRedirects zapsány: src/lib/redirects/product-redirects.json (${redirects.length})`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
