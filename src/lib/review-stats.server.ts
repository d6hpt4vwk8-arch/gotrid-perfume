import { prisma } from "@/lib/prisma";

export interface ReviewStats {
  average: number;
  count: number;
}

/**
 * Published-review rating per product, only for products that have at least one — callers show the stars
 * conditionally, so an unreviewed product simply has no entry (no empty "0 reviews" noise in search results).
 */
export async function getReviewStats(productIds: string[]): Promise<Map<string, ReviewStats>> {
  const stats = new Map<string, ReviewStats>();
  if (productIds.length === 0) return stats;
  const rows = await prisma.review.groupBy({
    by: ["productId"],
    where: { productId: { in: productIds }, published: true },
    _avg: { rating: true },
    _count: { _all: true },
  });
  for (const r of rows) {
    if (r._count._all > 0 && r._avg.rating !== null) {
      stats.set(r.productId, { average: r._avg.rating, count: r._count._all });
    }
  }
  return stats;
}
