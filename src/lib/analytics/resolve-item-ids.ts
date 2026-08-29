import { prisma } from "@/lib/prisma";

export interface OrderItemInput {
  productId: string | null;
  name: string;
  ean: string | null;
  qty: number;
  unitPrice: number;
}

/**
 * itemId should match the same identifier used as <ITEM_ID> in our product
 * feeds (product.code) so a price-comparison site can reconcile conversions
 * against the catalog it already has — OrderItem only stores
 * productId/ean/name, so this resolves code via a batch lookup, falling back
 * to ean/name for items whose product has since been deleted. Shared between
 * Zboží and Heureka's server-side conversion/order-report calls.
 */
export async function resolveItemCodes(items: OrderItemInput[]): Promise<Map<string, string>> {
  const productIds = items.map((i) => i.productId).filter((id): id is string => Boolean(id));
  if (productIds.length === 0) return new Map();
  const products = await prisma.product.findMany({
    where: { id: { in: productIds } },
    select: { id: true, code: true },
  });
  return new Map(products.map((p) => [p.id, p.code]));
}

export function toItemId(item: OrderItemInput, codeByProductId: Map<string, string>): string {
  return (item.productId && codeByProductId.get(item.productId)) || item.ean || item.name;
}
