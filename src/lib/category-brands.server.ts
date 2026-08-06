import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export interface BrandFacet {
  slug: string;
  name: string;
  count: number;
}

/** Brands present among visible products matching the given scope, with counts, for the filter sidebar. */
export async function getAvailableBrands(baseWhere: Prisma.ProductWhereInput): Promise<BrandFacet[]> {
  const grouped = await prisma.product.groupBy({
    by: ["brandId"],
    where: {
      visible: true,
      brandId: { not: null },
      ...baseWhere,
    },
    _count: { _all: true },
  });

  if (grouped.length === 0) return [];

  const brands = await prisma.brand.findMany({
    where: { id: { in: grouped.map((g) => g.brandId!) } },
    select: { id: true, name: true, slug: true },
  });
  const byId = new Map(brands.map((b) => [b.id, b]));

  return grouped
    .map((g) => {
      const brand = byId.get(g.brandId!);
      return brand ? { slug: brand.slug, name: brand.name, count: g._count._all } : null;
    })
    .filter((b): b is BrandFacet => b !== null)
    .sort((a, b) => a.name.localeCompare(b.name));
}
