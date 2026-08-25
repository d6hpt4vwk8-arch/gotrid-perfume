import type { Prisma } from "@prisma/client";
import { formatVolumeLabel } from "@/lib/parse-volume";

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

/**
 * Builds the "Parametry" table from data the product already has — nothing
 * here is invented. Gender is inferred from the category tree the same way
 * the storefront filters derive it (a product's gender is implied by which
 * category branch it sits in, not a separate field).
 */
export function getProductSpecs(product: ProductWithSpecs): ProductSpec[] {
  const specs: ProductSpec[] = [];

  if (product.brand) specs.push({ label: "Značka", value: product.brand.name });

  const volume = formatVolumeLabel(product.name);
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

  return specs;
}
