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
    where: { id: { in: rows.map((r) => r.productId) }, visible: true },
    include: { brand: true, images: { orderBy: { sortOrder: "asc" }, take: 1 } },
  });
  const byId = new Map(products.map((p) => [p.id, p]));

  // Preserve the co-purchase-count ordering from the raw query — Prisma's
  // findMany doesn't guarantee result order for an `id: { in }` filter.
  return rows.map((r) => byId.get(r.productId)).filter((p): p is NonNullable<typeof p> => Boolean(p));
}
