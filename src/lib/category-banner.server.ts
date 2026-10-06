import { prisma } from "@/lib/prisma";
import { primaryVariantWhere } from "@/lib/product-filters";

export type CategoryBannerTile = {
  id: string;
  name: string;
  fullSlug: string;
  count: number;
  images: { url: string; alt: string }[];
};

/**
 * One tile per direct subcategory that still has something in stock: its
 * in-stock product count plus the photos of its two best sellers, so the
 * banner shows what the category actually contains rather than just names.
 */
export async function getCategoryBannerTiles(
  children: { id: string; name: string; fullSlug: string; hidden: boolean }[],
): Promise<CategoryBannerTile[]> {
  const all = await prisma.category.findMany({ select: { id: true, parentId: true } });
  const childrenOf = new Map<string, string[]>();
  for (const c of all) {
    if (!c.parentId) continue;
    childrenOf.set(c.parentId, [...(childrenOf.get(c.parentId) ?? []), c.id]);
  }
  const descendants = (rootId: string) => {
    const ids: string[] = [];
    const queue = [rootId];
    while (queue.length > 0) {
      const id = queue.shift()!;
      ids.push(id);
      queue.push(...(childrenOf.get(id) ?? []));
    }
    return ids;
  };

  const tiles = await Promise.all(
    children
      .filter((c) => !c.hidden)
      .map(async (child) => {
        const where = {
          visible: true,
          stock: { gt: 0 },
          categories: { some: { categoryId: { in: descendants(child.id) } } },
          AND: [primaryVariantWhere],
        };
        const [count, products] = await Promise.all([
          prisma.product.count({ where }),
          prisma.product.findMany({
            where: { ...where, images: { some: {} } },
            orderBy: [{ salesCount: "desc" }, { priority: "desc" }, { createdAt: "desc" }],
            take: 2,
            select: { name: true, images: { orderBy: { sortOrder: "asc" }, take: 1, select: { url: true } } },
          }),
        ]);
        return {
          id: child.id,
          name: child.name,
          fullSlug: child.fullSlug,
          count,
          images: products.flatMap((p) => (p.images[0] ? [{ url: p.images[0].url, alt: p.name }] : [])),
        };
      }),
  );

  return tiles.filter((t) => t.count > 0);
}
