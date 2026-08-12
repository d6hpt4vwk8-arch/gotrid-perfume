import { prisma } from "@/lib/prisma";

export interface FeedProduct {
  code: string;
  name: string;
  slug: string;
  description: string | null;
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
    description: p.description,
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

  return disambiguateNames(feedProducts);
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
