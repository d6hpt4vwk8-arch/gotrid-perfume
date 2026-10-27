import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { buildOrderBy, type SortOption } from "@/lib/product-filters";

const listingInclude = { brand: true, images: { orderBy: { sortOrder: "asc" as const }, take: 1 } };

/**
 * One page of a product listing. Explicit sorts (price, bestsellers) are plain ORDER BYs. The default
 * "Doporučené" order needs a *boolean* "is in own stock" tier, which Prisma can't order by (ordering by
 * `ownStock` itself ranks 70 eyelashes ahead of everything with 5 units), so for that sort the matching
 * rows' ranking fields are sorted here and the page is cut from the ranked id list:
 *   1. products physically in our own stock first (owner's rule),
 *   2. then by what actually sells (salesCount),
 *   3. then by the manual pin (priority), then newest — so pinned items still lead among unsold ones.
 */
export async function findProductsPage(args: {
  where: Prisma.ProductWhereInput;
  sort: SortOption;
  page: number;
  pageSize: number;
}) {
  const { where, sort, page, pageSize } = args;
  const skip = (page - 1) * pageSize;
  if (sort !== "newest") {
    return prisma.product.findMany({ where, orderBy: buildOrderBy(sort), skip, take: pageSize, include: listingInclude });
  }

  const ranked = await prisma.product.findMany({
    where,
    select: { id: true, ownStock: true, salesCount: true, priority: true, createdAt: true },
  });
  ranked.sort(
    (a, b) =>
      Number(b.ownStock > 0) - Number(a.ownStock > 0) ||
      b.salesCount - a.salesCount ||
      b.priority - a.priority ||
      b.createdAt.getTime() - a.createdAt.getTime(),
  );
  const ids = ranked.slice(skip, skip + pageSize).map((r) => r.id);
  if (ids.length === 0) return [];
  const rows = await prisma.product.findMany({ where: { id: { in: ids } }, include: listingInclude });
  const byId = new Map(rows.map((r) => [r.id, r]));
  return ids.map((id) => byId.get(id)).filter((p): p is NonNullable<typeof p> => Boolean(p));
}
