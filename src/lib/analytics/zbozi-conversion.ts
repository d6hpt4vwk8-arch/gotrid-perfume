import { prisma } from "@/lib/prisma";

// Zboží.cz's own backend conversion API (github.com/seznam/zbozi-konverze),
// separate from — but reported alongside — the client-side rc.conversionHit
// tag fired in src/components/sklik-conversion.tsx. No signature scheme:
// the secret key is sent as a plain JSON field directly to Zboží's server,
// never exposed to the browser.
const SHOP_ID = process.env.ZBOZI_SHOP_ID;
const SECRET_KEY = process.env.ZBOZI_SECRET_KEY;

export function isZboziConversionConfigured(): boolean {
  return Boolean(SHOP_ID && SECRET_KEY);
}

interface OrderItemInput {
  productId: string | null;
  name: string;
  ean: string | null;
  qty: number;
  unitPrice: number;
}

export interface ZboziConversionEvent {
  orderId: string;
  items: OrderItemInput[];
  email?: string;
  deliveryType?: string;
  deliveryPrice?: number;
  otherCosts?: number;
  paymentType?: string;
}

// itemId should match the same identifier used as <ITEM_ID> in our product
// feeds (product.code) so Zboží can reconcile conversions against the
// catalog it already has — OrderItem only stores productId/ean/name, so
// this resolves code via a batch lookup, falling back to ean/name for
// items whose product has since been deleted.
async function resolveItemIds(items: OrderItemInput[]): Promise<Map<string, string>> {
  const productIds = items.map((i) => i.productId).filter((id): id is string => Boolean(id));
  if (productIds.length === 0) return new Map();
  const products = await prisma.product.findMany({
    where: { id: { in: productIds } },
    select: { id: true, code: true },
  });
  return new Map(products.map((p) => [p.id, p.code]));
}

export async function sendZboziConversion(event: ZboziConversionEvent): Promise<void> {
  if (!isZboziConversionConfigured()) {
    console.warn(`[zbozi-conversion] not configured — skipping order ${event.orderId}`);
    return;
  }

  const codeByProductId = await resolveItemIds(event.items);
  const cart = event.items.map((item) => ({
    itemId: (item.productId && codeByProductId.get(item.productId)) || item.ean || item.name,
    productName: item.name,
    unitPrice: item.unitPrice,
    quantity: item.qty,
  }));

  const payload = {
    PRIVATE_KEY: SECRET_KEY,
    sandbox: false,
    orderId: event.orderId,
    cart,
    ...(event.email && { email: event.email }),
    ...(event.deliveryType && { deliveryType: event.deliveryType }),
    ...(event.deliveryPrice !== undefined && { deliveryPrice: event.deliveryPrice }),
    ...(event.otherCosts !== undefined && { otherCosts: event.otherCosts }),
    ...(event.paymentType && { paymentType: event.paymentType }),
  };

  const res = await fetch(`https://www.zbozi.cz/action/${SHOP_ID}/conversion/backend`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    console.error(`[zbozi-conversion] failed for order ${event.orderId}: ${res.status} ${await res.text()}`);
  }
}
