import { prisma } from "@/lib/prisma";
import { feedDescription } from "./xml";

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
}

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

/** Products + resolved data needed by every marketplace feed (Heureka/Zboží/Google/Meta). */
export async function getFeedProducts(): Promise<FeedProduct[]> {
  const [products, breadcrumbs] = await Promise.all([
    prisma.product.findMany({
      where: { visible: true },
      include: {
        brand: true,
        images: { orderBy: { sortOrder: "asc" } },
        categories: { include: { category: true }, take: 1 },
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
