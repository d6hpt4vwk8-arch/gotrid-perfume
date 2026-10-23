import { prisma } from "@/lib/prisma";
import { buildProductWhere, parseFilterParams } from "@/lib/product-filters";
import { skScope } from "@/lib/sk-visibility";

export const KBEAUTY_FULL_SLUG = "kosmetika/korejska-kosmetika";

/** Concern tiles for the K-beauty category: only concerns that currently have in-stock products, most populated first. */
export async function getKbeautyAdvisorConcerns(categoryIds: string[], isSk: boolean) {
  const baseWhere = skScope({ categories: { some: { categoryId: { in: categoryIds } } } }, isSk);
  const concerns = await prisma.concern.findMany({ select: { slug: true, name: true } });
  const withCounts = await Promise.all(
    concerns.map(async (c) => ({
      slug: c.slug,
      name: c.name,
      count: await prisma.product.count({ where: buildProductWhere(baseWhere, parseFilterParams({ concern: c.slug })) }),
    })),
  );
  return withCounts.filter((c) => c.count > 0).sort((a, b) => b.count - a.count);
}
