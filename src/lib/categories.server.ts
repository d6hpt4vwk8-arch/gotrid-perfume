import { prisma } from "@/lib/prisma";

export interface CategoryNavNode {
  id: string;
  name: string;
  fullSlug: string;
  hidden: boolean;
  children: CategoryNavNode[];
}

/** All categories, nested for header/footer navigation. Not paginated — the tree is small (TZ §2.1). */
export async function getCategoryNavTree(): Promise<CategoryNavNode[]> {
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
}

export async function findCategoryByFullSlug(fullSlug: string) {
  return prisma.category.findUnique({
    where: { fullSlug },
    include: { children: { orderBy: { sortOrder: "asc" } } },
  });
}
