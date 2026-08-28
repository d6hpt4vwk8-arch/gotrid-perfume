import { unstable_cache } from "next/cache";
import { prisma } from "@/lib/prisma";

export interface CategoryNavNode {
  id: string;
  name: string;
  fullSlug: string;
  hidden: boolean;
  children: CategoryNavNode[];
}

// The nav tree renders on every single storefront page via SiteHeader, so an
// uncached query here means every page load pays a DB round trip just for
// navigation links that change maybe a few times a year. Cached for 5
// minutes and busted immediately by admin category edits (see
// admin/actions/categories.ts) — a much better trade than re-fetching on
// every request.
export const getCategoryNavTree = unstable_cache(
  async (): Promise<CategoryNavNode[]> => {
    const categories = await prisma.category.findMany({
      orderBy: [{ sortOrder: "asc" }],
      select: { id: true, name: true, fullSlug: true, hidden: true, parentId: true },
    });

    const byId = new Map<string, CategoryNavNode>(
      categories.map((c) => [c.id, { ...c, children: [] }]),
    );

    const roots: CategoryNavNode[] = [];
    for (const category of categories) {
      const node = byId.get(category.id)!;
      if (category.parentId) {
        byId.get(category.parentId)?.children.push(node);
      } else {
        roots.push(node);
      }
    }

    return roots;
  },
  ["category-nav-tree"],
  { tags: ["category-nav"], revalidate: 300 },
);

export async function findCategoryByFullSlug(fullSlug: string) {
  return prisma.category.findUnique({
    where: { fullSlug },
    include: { children: { orderBy: { sortOrder: "asc" } } },
  });
}

/**
 * Ancestor chain (root first, leaf last) for a category's fullSlug, e.g.
 * "parfemy/damske-parfemy/parfemovane-vody" -> [Parfémy, Dámské parfémy,
 * Parfémované vody]. Uses the materialized fullSlug path to resolve every
 * ancestor in one query instead of walking parentId links one at a time.
 */
export async function getCategoryBreadcrumb(fullSlug: string) {
  const segments = fullSlug.split("/");
  const ancestorSlugs = segments.map((_, i) => segments.slice(0, i + 1).join("/"));
  const categories = await prisma.category.findMany({
    where: { fullSlug: { in: ancestorSlugs } },
    select: { name: true, fullSlug: true },
  });
  const byFullSlug = new Map(categories.map((c) => [c.fullSlug, c]));
  return ancestorSlugs
    .map((slug) => byFullSlug.get(slug))
    .filter((c): c is { name: string; fullSlug: string } => Boolean(c));
}
