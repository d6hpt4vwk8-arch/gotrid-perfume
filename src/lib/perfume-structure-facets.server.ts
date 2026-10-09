import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getDescendantCategoryIds } from "@/lib/category-descendants.server";

export interface StructureFacetOption {
  slug: string;
  name: string;
  count: number;
}

export interface PerfumeStructureFacets {
  genderOptions: StructureFacetOption[];
  concentrationOptions: StructureFacetOption[];
  occasionOptions: StructureFacetOption[];
}

/** Perfume type shown in the "Typ" filter (Product.concentration), ordered light → concentrated. */
export const CONCENTRATION_LABELS: Record<string, string> = {
  "toaletni-voda": "Toaletní voda",
  "parfemovana-voda": "Parfémovaná voda",
  "parfemovy-extrakt": "Parfémový extrakt",
  "parfemovy-olej": "Parfémový olej",
  "kolinska-voda": "Kolínská voda",
  parfem: "Parfém",
};

/** Old "Typ" URLs used category leaf slugs — keep them working. */
export const LEGACY_CONCENTRATION_SLUGS: Record<string, string> = {
  "parfemovane-vody": "parfemovana-voda",
  "toaletni-vody": "toaletni-voda",
  "parfemovane-oleje": "parfemovy-olej",
};

/** "Příležitost" (Product.occasions, rule-based from scent families — see scripts/backfill-perfume-filters.ts). */
export const OCCASION_LABELS: Record<string, string> = {
  "kazdy-den": "Na každý den",
  "do-prace": "Do práce",
  vecer: "Na večer a rande",
  leto: "Na léto",
  zima: "Na zimu",
};

const GENDER_SLUGS = new Set(["damske-parfemy", "panske-parfemy", "unisex-parfemy"]);

/**
 * "Pro koho" (gender) and "Typ" (concentration) facets, derived from the
 * existing category tree structure rather than a separate taxonomy — a
 * product's gender/concentration is already implied by which category branch
 * it sits in. Works over any product scope (a category subtree, a search
 * match, ...): options with zero matches are dropped, so this naturally
 * stays empty outside the Parfémy catalog.
 */
export async function getPerfumeStructureFacets(
  baseWhere: Prisma.ProductWhereInput,
): Promise<PerfumeStructureFacets> {
  const genderCats = await prisma.category.findMany({
    where: { slug: { in: Array.from(GENDER_SLUGS) } },
    select: { id: true, slug: true, name: true },
  });

  const genderOptions: StructureFacetOption[] = [];
  for (const cat of genderCats) {
    const descendantIds = await getDescendantCategoryIds(cat.id);
    const count = await prisma.product.count({
      where: {
        visible: true,
        // AND (not a second `categories` key) — baseWhere already has its
        // own `categories` filter (the current page's scope), and spreading
        // both into one object would let this one silently clobber it,
        // making every option count catalog-wide instead of within scope.
        AND: [baseWhere, { categories: { some: { categoryId: { in: descendantIds } } } }],
      },
    });
    if (count > 0) genderOptions.push({ slug: cat.slug, name: cat.name, count });
  }

  const grouped = await prisma.product.groupBy({
    by: ["concentration"],
    where: { visible: true, concentration: { not: null }, AND: [baseWhere] },
    _count: { _all: true },
  });
  const concentrationOptions: StructureFacetOption[] = Object.entries(CONCENTRATION_LABELS)
    .map(([slug, name]) => ({ slug, name, count: grouped.find((g) => g.concentration === slug)?._count._all ?? 0 }))
    .filter((o) => o.count > 0);

  const occasionOptions: StructureFacetOption[] = [];
  for (const [slug, name] of Object.entries(OCCASION_LABELS)) {
    const count = await prisma.product.count({
      where: { visible: true, AND: [baseWhere, { occasions: { has: slug } }] },
    });
    if (count > 0) occasionOptions.push({ slug, name, count });
  }

  return { genderOptions, concentrationOptions, occasionOptions };
}

/**
 * Resolves selected "Pro koho" (gender) filter slugs to the concrete leaf category ids they represent,
 * for use as an additional scope in buildProductWhere. Gender slugs are parent categories (a product is
 * tagged on a leaf beneath them, e.g. "parfemovane-vody" under "damske-parfemy"), so they are expanded to
 * their full descendant set. Returns null when the filter is not active. ("Typ" no longer goes through
 * categories — it reads Product.concentration directly.)
 */
export async function resolvePerfumeFilterCategoryIds(genderSlugs: string[]): Promise<string[] | null> {
  if (genderSlugs.length === 0) return null;
  const genderCats = await prisma.category.findMany({
    where: { slug: { in: genderSlugs } },
    select: { id: true },
  });
  const descendantLists = await Promise.all(genderCats.map((c) => getDescendantCategoryIds(c.id)));
  return Array.from(new Set(descendantLists.flat()));
}
