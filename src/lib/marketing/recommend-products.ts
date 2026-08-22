import { prisma } from "@/lib/prisma";

// Root categories that mean "this customer buys home/car fragrance, not
// perfume" — used to decide whether the "second order" email pitches
// perfumes or diffusers/candles instead (customer's own request: someone
// who only ever bought a diffuser rarely wants a perfume upsell).
const HOME_FRAGRANCE_ROOTS = ["Aroma Difuzéry", "Vonné svíčky", "Vůně do auta"];
const PERFUME_ROOTS = ["Parfémy", "Niche"];

export type RecommendationTheme = "home_fragrance" | "perfume";

export interface RecommendedProduct {
  id: string;
  name: string;
  slug: string;
  price: number;
  imageUrl: string | null;
}

async function getRootCategoryName(categoryId: string): Promise<string | null> {
  let current = await prisma.category.findUnique({
    where: { id: categoryId },
    select: { name: true, parentId: true },
  });
  while (current?.parentId) {
    current = await prisma.category.findUnique({
      where: { id: current.parentId },
      select: { name: true, parentId: true },
    });
  }
  return current?.name ?? null;
}

async function getCategoryIdsUnderRoot(rootName: string): Promise<string[]> {
  const root = await prisma.category.findFirst({
    where: { name: rootName, parentId: null },
    select: { fullSlug: true },
  });
  if (!root) return [];
  const categories = await prisma.category.findMany({
    where: { OR: [{ fullSlug: root.fullSlug }, { fullSlug: { startsWith: `${root.fullSlug}/` } }] },
    select: { id: true },
  });
  return categories.map((c) => c.id);
}

/**
 * Looks at what a customer has bought before and picks a theme + a handful
 * of in-stock products to recommend in the "second order" email — perfumes
 * by default, or home/car fragrance if that's the only thing they've bought
 * so far.
 */
export async function recommendProductsForCustomer(
  customerId: string,
): Promise<{ theme: RecommendationTheme; products: RecommendedProduct[] }> {
  const items = await prisma.orderItem.findMany({
    where: { order: { customerId }, productId: { not: null } },
    select: { product: { select: { id: true, categories: { select: { categoryId: true }, take: 1 } } } },
  });

  const purchasedProductIds = new Set(items.map((i) => i.product!.id));
  const rootNames = new Set<string>();
  for (const item of items) {
    const categoryId = item.product?.categories[0]?.categoryId;
    if (!categoryId) continue;
    const root = await getRootCategoryName(categoryId);
    if (root) rootNames.add(root);
  }

  const isHomeFragranceOnly =
    rootNames.size > 0 && [...rootNames].every((name) => HOME_FRAGRANCE_ROOTS.includes(name));
  const theme: RecommendationTheme = isHomeFragranceOnly ? "home_fragrance" : "perfume";
  const targetRoots = isHomeFragranceOnly ? HOME_FRAGRANCE_ROOTS : PERFUME_ROOTS;

  const categoryIdLists = await Promise.all(targetRoots.map(getCategoryIdsUnderRoot));
  const categoryIds = categoryIdLists.flat();

  const products = await prisma.product.findMany({
    where: {
      visible: true,
      stock: { gt: 0 },
      id: { notIn: [...purchasedProductIds] },
      categories: { some: { categoryId: { in: categoryIds } } },
    },
    select: {
      id: true,
      name: true,
      slug: true,
      price: true,
      images: { take: 1, orderBy: { sortOrder: "asc" }, select: { url: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 3,
  });

  return {
    theme,
    products: products.map((p) => ({
      id: p.id,
      name: p.name,
      slug: p.slug,
      price: Number(p.price),
      imageUrl: p.images[0]?.url ?? null,
    })),
  };
}
