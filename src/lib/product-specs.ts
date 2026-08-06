import type { Prisma } from "@prisma/client";

type ProductWithSpecs = Prisma.ProductGetPayload<{
  include: { brand: true; categories: { include: { category: true } } };
}>;

export interface ProductSpec {
  label: string;
  value: string;
}

const GENDER_LABELS: Record<string, string> = {
  "damske-parfemy": "Dámské",
  "panske-parfemy": "Pánské",
  "unisex-parfemy": "Unisex",
};

/** Volume is never a separate DB field — it's baked into the product name by the supplier feed ("… 100 ml"), so we parse it out rather than duplicate it as fabricated data. */
function parseVolume(name: string): string | null {
  const match = name.match(/(\d+(?:[.,]\d+)?)\s*ml\b/i);
  return match ? `${match[1]} ml` : null;
}

/**
 * Builds the "Parametry" table from data the product already has — nothing
 * here is invented. Gender is inferred from the category tree the same way
 * the storefront filters derive it (a product's gender is implied by which
 * category branch it sits in, not a separate field).
 */
export function getProductSpecs(product: ProductWithSpecs): ProductSpec[] {
  const specs: ProductSpec[] = [];

  if (product.brand) specs.push({ label: "Značka", value: product.brand.name });

  const volume = parseVolume(product.name);
  if (volume) specs.push({ label: "Objem", value: volume });

  const category = product.categories[0]?.category;
  if (category) {
    specs.push({ label: "Kategorie", value: category.name });

    const genderSlug = Object.keys(GENDER_LABELS).find(
      (slug) => category.fullSlug === slug || category.fullSlug.includes(`/${slug}`),
    );
    if (genderSlug) specs.push({ label: "Pro koho", value: GENDER_LABELS[genderSlug] });
  }

  if (product.ean) specs.push({ label: "EAN", value: product.ean });
  specs.push({ label: "Kód", value: product.code });

  return specs;
}
