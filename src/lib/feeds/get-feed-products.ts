import { prisma } from "@/lib/prisma";
import { formatVolumeLabel } from "@/lib/parse-volume";
import { feedDescription } from "./xml";

export interface FeedParam {
  name: string;
  value: string;
}

export interface FeedProduct {
  code: string;
  name: string;
  slug: string;
  /** Always non-empty and unique across the returned list — see feedDescription()/disambiguateDescriptions() below. */
  description: string;
  price: number;
  compareAtPrice: number | null;
  stock: number;
  ean: string | null;
  brandName: string | null;
  images: string[];
  categoryBreadcrumb: string | null;
  excludeFromHeureka: boolean;
  /**
   * PARAM pairs for the marketplace feeds. These are what put an offer into
   * the comparison sites' category filters ("Objem 100 ml", "Pro koho
   * Dámské", …) — without them an offer only ever surfaces on a plain
   * name/price match, which is why Heureka flagged 122 offers as missing
   * <PARAM>. Only real data: nothing here is guessed.
   */
  params: FeedParam[];
}

// Same category→gender inference the storefront's spec table uses
// (src/lib/product-specs.ts) — a perfume's gender is implied by which
// category branch it sits in rather than being a field of its own.
const GENDER_LABELS: Record<string, string> = {
  "damske-parfemy": "Dámské",
  "panske-parfemy": "Pánské",
  "unisex-parfemy": "Unisex",
};

async function buildCategoryBreadcrumbs(): Promise<Map<string, string>> {
  const categories = await prisma.category.findMany({
    select: { id: true, name: true, parentId: true },
  });
  const byId = new Map(categories.map((c) => [c.id, c]));

  const breadcrumb = new Map<string, string>();
  function resolve(id: string): string {
    if (breadcrumb.has(id)) return breadcrumb.get(id)!;
    const category = byId.get(id);
    if (!category) return "";
    const path = category.parentId
      ? `${resolve(category.parentId)} | ${category.name}`
      : category.name;
    breadcrumb.set(id, path);
    return path;
  }

  for (const category of categories) resolve(category.id);
  return breadcrumb;
}

type ProductForParams = {
  name: string;
  brand: { name: string } | null;
  categories: { category: { name: string; fullSlug: string } }[];
  scentFamilies: { scentFamily: { name: string } }[];
  skinTypes: { skinType: { name: string } }[];
  concerns: { concern: { name: string } }[];
};

function buildParams(product: ProductForParams): FeedParam[] {
  const params: FeedParam[] = [];

  if (product.brand) params.push({ name: "Značka", value: product.brand.name });

  // Volume lives in the product name (supplier feeds bake it in), not a
  // column — see parse-volume.ts. Present on ~94 % of the live catalog and
  // it's the single most-used filter in perfume/cosmetics categories.
  const volume = formatVolumeLabel(product.name);
  if (volume) params.push({ name: "Objem", value: volume });

  const category = product.categories[0]?.category;
  if (category) {
    const genderSlug = Object.keys(GENDER_LABELS).find(
      (slug) => category.fullSlug === slug || category.fullSlug.includes(`/${slug}`),
    );
    if (genderSlug) params.push({ name: "Pro koho", value: GENDER_LABELS[genderSlug] });
  }

  // Multi-value attributes get one PARAM each rather than a joined string —
  // a comma-joined value matches no filter at all on either marketplace.
  for (const { scentFamily } of product.scentFamilies) {
    params.push({ name: "Charakter vůně", value: scentFamily.name });
  }
  for (const { skinType } of product.skinTypes) {
    params.push({ name: "Typ pleti", value: skinType.name });
  }
  for (const { concern } of product.concerns) {
    params.push({ name: "Účel", value: concern.name });
  }

  return params;
}

/** Products + resolved data needed by every marketplace feed (Heureka/Zboží/Google/Meta). */
export async function getFeedProducts(): Promise<FeedProduct[]> {
  const [products, breadcrumbs] = await Promise.all([
    prisma.product.findMany({
      where: { visible: true },
      include: {
        brand: true,
        images: { orderBy: { sortOrder: "asc" } },
        categories: { include: { category: true }, take: 1 },
        scentFamilies: { include: { scentFamily: true } },
        skinTypes: { include: { skinType: true } },
        concerns: { include: { concern: true } },
      },
    }),
    buildCategoryBreadcrumbs(),
  ]);

  const feedProducts = products.map((p) => ({
    code: p.code,
    name: p.name,
    slug: p.slug,
    description: feedDescription(p),
    price: Number(p.price),
    compareAtPrice: p.compareAtPrice ? Number(p.compareAtPrice) : null,
    stock: p.stock,
    ean: p.ean,
    brandName: p.brand?.name ?? null,
    images: p.images.map((i) => i.url),
    categoryBreadcrumb: p.categories[0]
      ? (breadcrumbs.get(p.categories[0].categoryId) ?? null)
      : null,
    excludeFromHeureka: p.excludeFromHeureka,
    params: buildParams(p),
  }));

  return disambiguateDescriptions(disambiguateNames(feedProducts));
}

// A handful of products (different EAN/price, genuinely distinct SKUs —
// e.g. several car-freshener scent refills that were never given
// distinguishing names on import) share an identical name string.
// Zboží.cz's feed validator rejects a feed with any duplicate PRODUCTNAME
// value, so — for feed output only, the stored Product.name / storefront
// display is untouched — every name beyond the first in a collision group
// gets its product code appended to make it unique.
function disambiguateNames(products: FeedProduct[]): FeedProduct[] {
  const counts = new Map<string, number>();
  for (const p of products) counts.set(p.name, (counts.get(p.name) ?? 0) + 1);

  const seen = new Map<string, number>();
  return products.map((p) => {
    if ((counts.get(p.name) ?? 0) < 2) return p;
    const index = (seen.get(p.name) ?? 0) + 1;
    seen.set(p.name, index);
    return index === 1 ? p : { ...p, name: `${p.name} (${p.code})` };
  });
}

// Several supplier feeds (mainly SP Venture) reuse identical boilerplate
// description text across genuinely distinct products — e.g. 62 different
// perfumes whose entire DESCRIPTION is just the literal string "Eau De
// Parfum". Heureka/Zboží both flag repeated DESCRIPTION values. Rather than
// fabricate per-product copy, every description beyond the first in a
// collision group gets the product's own (already-disambiguated) name
// appended — true, sourced-from-the-product-itself text, not invented.
function disambiguateDescriptions(products: FeedProduct[]): FeedProduct[] {
  const counts = new Map<string, number>();
  for (const p of products) counts.set(p.description, (counts.get(p.description) ?? 0) + 1);

  const seen = new Map<string, number>();
  return products.map((p) => {
    if ((counts.get(p.description) ?? 0) < 2) return p;
    const index = (seen.get(p.description) ?? 0) + 1;
    seen.set(p.description, index);
    return index === 1 ? p : { ...p, description: `${p.description} — ${p.name}` };
  });
}
