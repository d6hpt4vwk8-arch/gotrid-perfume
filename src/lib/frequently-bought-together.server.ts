import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

/**
 * Products most often co-purchased with `productId` in the same order —
 * a much stronger cross-sell signal than same-category "similar products"
 * (a Dove shower gel and a Versace shower gel share a category but nobody
 * actually buys them together). Requires at least 2 separate orders pairing
 * the two products, so a single coincidental cart doesn't get labeled
 * "frequently" bought together.
 */
export async function getFrequentlyBoughtTogether(productId: string, limit = 4) {
  const rows = await prisma.$queryRaw<{ productId: string; coCount: bigint }[]>`
    SELECT oi2."productId" AS "productId", COUNT(DISTINCT oi2."orderId") AS "coCount"
    FROM "OrderItem" oi1
    JOIN "OrderItem" oi2
      ON oi2."orderId" = oi1."orderId"
     AND oi2."productId" IS NOT NULL
     AND oi2."productId" != oi1."productId"
    WHERE oi1."productId" = ${productId}
    GROUP BY oi2."productId"
    HAVING COUNT(DISTINCT oi2."orderId") >= 2
    ORDER BY "coCount" DESC
    LIMIT ${limit}
  `;
  if (rows.length === 0) return [];

  const products = await prisma.product.findMany({
    where: { id: { in: rows.map((r) => r.productId) }, visible: true, stock: { gt: 0 } },
    include: { brand: true, images: { orderBy: { sortOrder: "asc" }, take: 1 } },
  });
  const byId = new Map(products.map((p) => [p.id, p]));

  // Preserve the co-purchase-count ordering from the raw query — Prisma's
  // findMany doesn't guarantee result order for an `id: { in }` filter.
  return rows.map((r) => byId.get(r.productId)).filter((p): p is NonNullable<typeof p> => Boolean(p));
}

/**
 * Same co-purchase signal as getFrequentlyBoughtTogether, but for a whole
 * cart (multiple product ids) instead of one product page — backs the
 * "Doplňte objednávku" section on the cart page. Falls back to the shop's
 * own priority-ranked catalog when the cart's items don't have enough
 * shared order history yet (a brand-new product, or too few past orders),
 * so the section never just renders empty.
 */
export async function getFrequentlyBoughtTogetherForCart(cartProductIds: string[], limit = 3) {
  if (cartProductIds.length === 0) return [];

  const rows = await prisma.$queryRaw<{ productId: string; coCount: bigint }[]>`
    SELECT oi2."productId" AS "productId", COUNT(DISTINCT oi2."orderId") AS "coCount"
    FROM "OrderItem" oi1
    JOIN "OrderItem" oi2
      ON oi2."orderId" = oi1."orderId"
     AND oi2."productId" IS NOT NULL
     AND oi2."productId" NOT IN (${Prisma.join(cartProductIds)})
    WHERE oi1."productId" IN (${Prisma.join(cartProductIds)})
    GROUP BY oi2."productId"
    HAVING COUNT(DISTINCT oi2."orderId") >= 2
    ORDER BY "coCount" DESC
    LIMIT ${limit}
  `;

  if (rows.length > 0) {
    const products = await prisma.product.findMany({
      where: { id: { in: rows.map((r) => r.productId) }, visible: true, stock: { gt: 0 } },
      include: { brand: true, images: { orderBy: { sortOrder: "asc" }, take: 1 } },
    });
    const byId = new Map(products.map((p) => [p.id, p]));
    const ordered = rows.map((r) => byId.get(r.productId)).filter((p): p is NonNullable<typeof p> => Boolean(p));
    if (ordered.length > 0) return ordered;
  }

  // No co-purchase signal yet (needs 2+ shared past orders, which is rare
  // across an 18k+-SKU catalog) — fall back to products sharing a category
  // with something actually in the cart, not straight to the shop-wide
  // bestseller list. A pure global `orderBy: priority` fallback showed the
  // same 3 VVBETTER skincare items on every single cart regardless of
  // contents, because that whole brand happens to be pinned at the max
  // priority (100) shopwide — a niche-perfume cart got pitched Korean
  // sunscreen just as often as anything else.
  const cartCategoryIds = (
    await prisma.productCategory.findMany({
      where: {
        productId: { in: cartProductIds },
        // "Výprodej" is a cross-cutting clearance tag applied on top of a
        // product's real category (a perfume, a tanning oil and a face mist
        // can all be "on sale" at once) — matching on it alone reproduces
        // exactly the irrelevant-fallback bug this is fixing, just scoped to
        // "everything discounted" instead of "everything top-priority".
        category: { name: { not: "Výprodej" } },
      },
      select: { categoryId: true },
    })
  ).map((c) => c.categoryId);

  if (cartCategoryIds.length > 0) {
    const sameCategory = await prisma.product.findMany({
      where: {
        visible: true,
        stock: { gt: 0 },
        id: { notIn: cartProductIds },
        categories: { some: { categoryId: { in: cartCategoryIds } } },
      },
      include: { brand: true, images: { orderBy: { sortOrder: "asc" }, take: 1 } },
      orderBy: { priority: "desc" },
      take: limit,
    });
    if (sameCategory.length > 0) return sameCategory;
  }

  // Last resort only — none of the cart's own categories have anything
  // else in stock to suggest.
  return prisma.product.findMany({
    where: { visible: true, stock: { gt: 0 }, id: { notIn: cartProductIds } },
    include: { brand: true, images: { orderBy: { sortOrder: "asc" }, take: 1 } },
    orderBy: { priority: "desc" },
    take: limit,
  });
}
