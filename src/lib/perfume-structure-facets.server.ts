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
}

const GENDER_SLUGS = new Set(["damske-parfemy", "panske-parfemy", "unisex-parfemy"]);
const CONCENTRATION_SLUGS = new Set(["parfemovane-vody", "toaletni-vody", "parfemovane-oleje"]);

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
        ...baseWhere,
        categories: { some: { categoryId: { in: descendantIds } } },
      },
    });
    if (count > 0) genderOptions.push({ slug: cat.slug, name: cat.name, count });
  }

  const concentrationCats = await prisma.category.findMany({
    where: { slug: { in: Array.from(CONCENTRATION_SLUGS) } },
    select: { id: true, slug: true, name: true },
  });
  const bySlug = new Map<string, { name: string; ids: string[] }>();
  for (const cat of concentrationCats) {
    const entry = bySlug.get(cat.slug) ?? { name: cat.name, ids: [] };
    entry.ids.push(cat.id);
    bySlug.set(cat.slug, entry);
  }

  const concentrationOptions: StructureFacetOption[] = [];
  for (const [slug, { name, ids }] of bySlug) {
    const count = await prisma.product.count({
      where: { visible: true, ...baseWhere, categories: { some: { categoryId: { in: ids } } } },
    });
    if (count > 0) concentrationOptions.push({ slug, name, count });
  }

  return { genderOptions, concentrationOptions };
}

/**
 * Resolves selected "Pro koho"/"Typ" filter slugs to the concrete leaf
 * category ids they represent, for use as an additional scope in
 * buildProductWhere. Gender slugs are parent categories (a product is tagged
 * on a leaf beneath them, e.g. "parfemovane-vody" under "damske-parfemy"), so
 * they're expanded to their full descendant set; concentration slugs are
 * already leaf-level but appear once per gender branch, so they resolve to
 * several ids. Selecting both intersects the two sets (OR within a facet,
 * AND across facets). Returns null when neither filter is active.
 */
export async function resolvePerfumeFilterCategoryIds(
  genderSlugs: string[],
  concentrationSlugs: string[],
): Promise<string[] | null> {
  if (genderSlugs.length === 0 && concentrationSlugs.length === 0) return null;

  let genderIds: Set<string> | null = null;
  if (genderSlugs.length > 0) {
    const genderCats = await prisma.category.findMany({
      where: { slug: { in: genderSlugs } },
      select: { id: true },
    });
    const descendantLists = await Promise.all(
      genderCats.map((c) => getDescendantCategoryIds(c.id)),
    );
    genderIds = new Set(descendantLists.flat());
  }

  let concentrationIds: Set<string> | null = null;
  if (concentrationSlugs.length > 0) {
    const concentrationCats = await prisma.category.findMany({
      where: { slug: { in: concentrationSlugs } },
      select: { id: true },
    });
    concentrationIds = new Set(concentrationCats.map((c) => c.id));
  }

  if (genderIds && concentrationIds) {
    return Array.from(genderIds).filter((id) => concentrationIds!.has(id));
  }
  return Array.from(genderIds ?? concentrationIds ?? []);
}
