import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export interface ScentFamilyFacet {
  slug: string;
  name: string;
  count: number;
}

/** Scent-family tags present among visible products matching the given scope, with counts. */
export async function getScentFamilyFacets(
  baseWhere: Prisma.ProductWhereInput,
): Promise<ScentFamilyFacet[]> {
  const families = await prisma.scentFamily.findMany({ orderBy: { name: "asc" } });
  if (families.length === 0) return [];

  const counted = await Promise.all(
    families.map(async (family) => {
      const count = await prisma.product.count({
        where: {
          visible: true,
          ...baseWhere,
          scentFamilies: { some: { scentFamily: { id: family.id } } },
        },
      });
      return { slug: family.slug, name: family.name, count };
    }),
  );

  return counted.filter((f) => f.count > 0);
}
