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

  return products.map((p) => ({
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
}
