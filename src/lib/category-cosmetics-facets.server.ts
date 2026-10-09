import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { INGREDIENT_LABELS, PRODUCT_TYPE_LABELS } from "@/lib/cosmetics-taxonomy";

export interface TagFacet {
  slug: string;
  name: string;
  count: number;
}

export interface CosmeticsFacets {
  skinTypes: TagFacet[];
  concerns: TagFacet[];
  /** "Druh produktu" — Product.productType */
  productTypes: TagFacet[];
  /** "Složka" — Product.keyIngredients */
  ingredients: TagFacet[];
  /** Counts for the Vegan / Cruelty-free quick toggles (0 hides the toggle). */
  vegan: number;
  crueltyFree: number;
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

  const typeGroups = await prisma.product.groupBy({
    by: ["productType"],
    where: { visible: true, productType: { not: null }, AND: [baseWhere] },
    _count: { _all: true },
  });
  const productTypes = Object.entries(PRODUCT_TYPE_LABELS)
    .map(([slug, name]) => ({ slug, name, count: typeGroups.find((g) => g.productType === slug)?._count._all ?? 0 }))
    .filter((f) => f.count > 0);

  const ingredients: TagFacet[] = [];
  for (const [slug, name] of Object.entries(INGREDIENT_LABELS)) {
    const count = await prisma.product.count({
      where: { visible: true, AND: [baseWhere, { keyIngredients: { has: slug } }] },
    });
    if (count > 0) ingredients.push({ slug, name, count });
  }
  ingredients.sort((a, b) => b.count - a.count);

  const [vegan, crueltyFree] = await Promise.all([
    prisma.product.count({ where: { visible: true, isVegan: true, AND: [baseWhere] } }),
    prisma.product.count({ where: { visible: true, isCrueltyFree: true, AND: [baseWhere] } }),
  ]);

  return {
    skinTypes: skinTypes.filter((f) => f.count > 0),
    concerns: concerns.filter((f) => f.count > 0),
    productTypes,
    ingredients,
    vegan,
    crueltyFree,
  };
}
