import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export interface TagFacet {
  slug: string;
  name: string;
  count: number;
}

export interface CosmeticsFacets {
  skinTypes: TagFacet[];
  concerns: TagFacet[];
}

/**
 * "Typ pleti" and "Účel" facets for products matching the given scope. Tags
 * are set manually by the admin (see product editor) — there's no reliable
 * text signal to auto-tag skin type/concern the way scent notes can be mined
 * from perfume descriptions, so this only surfaces whatever's been tagged so
 * far. Options with zero matches are dropped, so this naturally stays empty
 * outside the cosmetics catalog without needing a category-tree check.
 */
export async function getCosmeticsFacets(
  baseWhere: Prisma.ProductWhereInput,
): Promise<CosmeticsFacets> {
  const [skinTypeRows, concernRows] = await Promise.all([
    prisma.skinType.findMany({ orderBy: { name: "asc" } }),
    prisma.concern.findMany({ orderBy: { name: "asc" } }),
  ]);

  const skinTypes = await Promise.all(
    skinTypeRows.map(async (skinType) => {
      const count = await prisma.product.count({
        where: {
          visible: true,
          ...baseWhere,
          skinTypes: { some: { skinType: { id: skinType.id } } },
        },
      });
      return { slug: skinType.slug, name: skinType.name, count };
    }),
  );

  const concerns = await Promise.all(
    concernRows.map(async (concern) => {
      const count = await prisma.product.count({
        where: {
          visible: true,
          ...baseWhere,
          concerns: { some: { concern: { id: concern.id } } },
        },
      });
      return { slug: concern.slug, name: concern.name, count };
    }),
  );

  return {
    skinTypes: skinTypes.filter((f) => f.count > 0),
    concerns: concerns.filter((f) => f.count > 0),
  };
}
