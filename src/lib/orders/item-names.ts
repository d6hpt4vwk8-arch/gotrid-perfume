import { prisma } from "@/lib/prisma";

/**
 * OrderItem.name is the Czech name frozen at order time. For a Slovak
 * customer, show the product's Slovak name when it has one (falling back to
 * the stored name — e.g. for deleted or untranslated products).
 */
export async function localizedItemNames(
  items: { id: string; name: string; productId: string | null }[],
  locale: "cs" | "sk",
): Promise<Map<string, string>> {
  const names = new Map(items.map((i) => [i.id, i.name]));
  if (locale !== "sk") return names;
  const ids = items.map((i) => i.productId).filter((id): id is string => id !== null);
  if (ids.length === 0) return names;
  const products = await prisma.product.findMany({ where: { id: { in: ids } }, select: { id: true, nameSk: true } });
  const sk = new Map(products.map((p) => [p.id, p.nameSk]));
  for (const item of items) {
    const nameSk = item.productId ? sk.get(item.productId) : null;
    if (nameSk) names.set(item.id, nameSk);
  }
  return names;
}
