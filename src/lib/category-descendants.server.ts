import { prisma } from "@/lib/prisma";

/** Category tree is small (TZ §2.1, ~50 nodes) — fetching it whole and walking in memory is simpler than a recursive SQL CTE. */
export async function getDescendantCategoryIds(rootId: string): Promise<string[]> {
  const all = await prisma.category.findMany({ select: { id: true, parentId: true } });
  const childrenOf = new Map<string, string[]>();
  for (const c of all) {
    if (!c.parentId) continue;
    const list = childrenOf.get(c.parentId) ?? [];
    list.push(c.id);
    childrenOf.set(c.parentId, list);
  }

  const ids: string[] = [];
  const queue = [rootId];
  while (queue.length > 0) {
    const id = queue.shift()!;
    ids.push(id);
    queue.push(...(childrenOf.get(id) ?? []));
  }
  return ids;
}
