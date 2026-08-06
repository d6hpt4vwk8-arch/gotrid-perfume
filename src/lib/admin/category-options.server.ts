import { prisma } from "@/lib/prisma";

export interface CategoryOption {
  id: string;
  label: string; // indented by depth for <select> display
}

/** Flat, depth-indented list of all categories for admin <select> inputs. */
export async function getCategoryOptions(): Promise<CategoryOption[]> {
  const categories = await prisma.category.findMany({
    orderBy: [{ sortOrder: "asc" }],
    select: { id: true, name: true, parentId: true },
  });
  const byId = new Map(categories.map((c) => [c.id, c]));

  function depth(id: string): number {
    let d = 0;
    let current = byId.get(id);
    while (current?.parentId) {
      d++;
      current = byId.get(current.parentId);
    }
    return d;
  }

  const roots = categories.filter((c) => !c.parentId);
  const childrenOf = new Map<string, typeof categories>();
  for (const c of categories) {
    if (!c.parentId) continue;
    const list = childrenOf.get(c.parentId) ?? [];
    list.push(c);
    childrenOf.set(c.parentId, list);
  }

  const options: CategoryOption[] = [];
  function walk(id: string) {
    const cat = byId.get(id)!;
    options.push({ id, label: `${"— ".repeat(depth(id))}${cat.name}` });
    for (const child of childrenOf.get(id) ?? []) walk(child.id);
  }
  for (const root of roots) walk(root.id);

  return options;
}
