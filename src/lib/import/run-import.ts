import { prisma } from "@/lib/prisma";
import { slugify } from "@/lib/slug";
import { downloadProductImages } from "./download-images";
import { parseDecimal, parseIntSafe } from "./parse-number";
import { parseXlsxRows } from "./parse-xlsx";
import { resolveCategoryPath } from "./resolve-category";
import type { ImportRawRow, ImportReport } from "./types";

const DEFAULT_VAT_RATE = 21;

function uniqueSlugCandidate(name: string, code: string): string {
  const base = slugify(name);
  return base ? `${base}-${code.toLowerCase()}` : slugify(code);
}

async function resolveBrandId(brandName: string): Promise<string | null> {
  const trimmed = brandName.trim();
  if (!trimmed) return null;
  const slug = slugify(trimmed);
  const brand = await prisma.brand.upsert({
    where: { slug },
    update: {},
    create: { name: trimmed, slug },
  });
  return brand.id;
}

function validateRow(row: ImportRawRow): string | null {
  if (!row.code.trim()) return "Chybí povinné pole 'code' (kód produktu).";
  if (!row.name.trim()) return "Chybí povinné pole 'name' (název produktu).";
  if (parseDecimal(row.price) === null) return `Neplatná cena 'price': "${row.price}".`;
  return null;
}

async function importRow(row: ImportRawRow): Promise<
  { status: "created" | "updated"; warnings: string[] } | { status: "error"; message: string }
> {
  const validationError = validateRow(row);
  if (validationError) return { status: "error", message: validationError };

  const warnings: string[] = [];

  const brandName = row.manufacturer.trim() || row.znacka.trim();
  const brandId = await resolveBrandId(brandName);

  const categoryId = row.categoryText.trim()
    ? await resolveCategoryPath(prisma, row.categoryText)
    : null;

  const { urls: imageUrls, errors: imageErrors } = row.image.trim()
    ? await downloadProductImages(row.code.trim(), row.image)
    : { urls: [], errors: [] };
  warnings.push(...imageErrors);

  const purchasePrice = parseDecimal(row.purchasePrice) ?? 0;
  const price = parseDecimal(row.price)!;
  const vatRate = parseIntSafe(row.vatRate) ?? DEFAULT_VAT_RATE;
  const stock = parseIntSafe(row.stock) ?? 0;

  const existing = await prisma.product.findUnique({
    where: { code: row.code.trim() },
    select: { id: true, slug: true },
  });

  const slug = existing?.slug ?? uniqueSlugCandidate(row.name, row.code);

  await prisma.$transaction(async (tx) => {
    const product = await tx.product.upsert({
      where: { code: row.code.trim() },
      update: {
        pairCode: row.pairCode.trim() || null,
        name: row.name.trim(),
        ean: row.ean.trim() || null,
        brandId,
        purchasePrice,
        price,
        vatRate,
        description: row.description || null,
        stock,
      },
      create: {
        code: row.code.trim(),
        pairCode: row.pairCode.trim() || null,
        name: row.name.trim(),
        slug,
        ean: row.ean.trim() || null,
        brandId,
        purchasePrice,
        price,
        vatRate,
        description: row.description || null,
        stock,
      },
    });

    if (categoryId) {
      await tx.productCategory.deleteMany({ where: { productId: product.id } });
      await tx.productCategory.create({
        data: { productId: product.id, categoryId },
      });
    }

    if (imageUrls.length > 0) {
      await tx.productImage.deleteMany({ where: { productId: product.id } });
      await tx.productImage.createMany({
        data: imageUrls.map((url, index) => ({
          productId: product.id,
          url,
          sortOrder: index,
        })),
      });
    }
  });

  return { status: existing ? "updated" : "created", warnings };
}

export async function runXlsxImport(buffer: Buffer): Promise<ImportReport> {
  const { rows } = await parseXlsxRows(buffer);

  const report: ImportReport = { created: 0, updated: 0, errors: [] };

  // Sequential on purpose: rows can create shared Brand/Category rows and
  // download images from external hosts — parallelizing would race on those
  // upserts and hammer the source servers.
  for (let i = 0; i < rows.length; i++) {
    const rowNumber = i + 2; // +1 for header, +1 for 1-indexing
    const row = rows[i];
    try {
      const result = await importRow(row);
      if (result.status === "error") {
        report.errors.push({ row: rowNumber, code: row.code, message: result.message });
      } else {
        report[result.status]++;
        for (const warning of result.warnings) {
          report.errors.push({ row: rowNumber, code: row.code, message: `Varování: ${warning}` });
        }
      }
    } catch (err) {
      report.errors.push({
        row: rowNumber,
        code: row.code,
        message: err instanceof Error ? err.message : "Neznámá chyba při importu řádku.",
      });
    }
  }

  return report;
}
