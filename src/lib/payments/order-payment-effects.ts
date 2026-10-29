import { prisma } from "@/lib/prisma";
import { sendMetaCapiEvent } from "@/lib/analytics/meta-capi";
import { sendZboziConversion } from "@/lib/analytics/zbozi-conversion";
import { sendHeurekaOrderLog } from "@/lib/analytics/heureka-overeno";
import { awardPointsForOrder } from "@/lib/loyalty";
import { resolveItemCodes, toItemId } from "@/lib/analytics/resolve-item-ids";
import { SITE_URL } from "@/lib/site";

/**
 * A card/online payment was confirmed by the gateway: NEW → PAID exactly once, then the same follow-ups the
 * Stripe webhook runs (Meta Purchase + Zboží conversion only with marketing consent, Heureka satisfaction survey,
 * loyalty points). Returns false when the order was already past NEW (a retried webhook) so nothing fires twice.
 */
export async function markOrderPaid(orderId: string): Promise<boolean> {
  const claimed = await prisma.order.updateMany({ where: { id: orderId, status: "NEW" }, data: { status: "PAID" } });
  if (claimed.count === 0) return false;

  const order = await prisma.order.findUniqueOrThrow({ where: { id: orderId }, include: { items: true } });
  const itemInputs = order.items.map((i) => ({
    productId: i.productId,
    name: i.name,
    ean: i.ean,
    qty: i.qty,
    unitPrice: Number(i.unitPrice),
  }));

  if (order.marketingConsent) {
    void (async () => {
      // Meta's catalog keys products by `code`, not the internal productId OrderItem stores.
      const codeByProductId = await resolveItemCodes(itemInputs);
      await sendMetaCapiEvent({
        eventName: "Purchase",
        eventId: order.number,
        eventSourceUrl: `${SITE_URL}/objednavka/${order.number}`,
        user: { email: order.email },
        customData: {
          currency: "CZK",
          value: Number(order.total),
          content_ids: itemInputs.map((i) => toItemId(i, codeByProductId)),
          num_items: order.items.reduce((sum, i) => sum + i.qty, 0),
        },
      });
    })().catch((err) => console.error(`[meta-capi] purchase event failed for ${order.number}`, err));

    void sendZboziConversion({
      orderId: order.number,
      items: itemInputs,
      deliveryType: order.shippingMethod,
      deliveryPrice: Number(order.shippingPrice),
      otherCosts: Number(order.discountAmount) > 0 ? -Number(order.discountAmount) : undefined,
      paymentType: order.paymentMethod,
    }).catch((err) => console.error(`[zbozi-conversion] failed for ${order.number}`, err));
  }

  // Heureka's survey is a service request about an order the customer just paid for, not ad tracking.
  void sendHeurekaOrderLog({ orderId: order.number, email: order.email, items: itemInputs, country: order.shippingCountry }).catch((err) =>
    console.error(`[heureka-overeno] failed for ${order.number}`, err),
  );
  void awardPointsForOrder(order.id).catch((err) => console.error(`[loyalty] award failed for ${order.number}`, err));
  return true;
}

/**
 * The payment was cancelled or expired before being paid: cancel the still-NEW order and put its stock back
 * (card orders decrement stock when created). Safe against retries — a second call finds the order already CANCELLED.
 */
export async function cancelUnpaidOrder(orderId: string): Promise<boolean> {
  return prisma.$transaction(async (tx) => {
    const claimed = await tx.order.updateMany({ where: { id: orderId, status: "NEW" }, data: { status: "CANCELLED" } });
    if (claimed.count === 0) return false;
    const items = await tx.orderItem.findMany({ where: { orderId } });
    for (const item of items) {
      if (!item.productId) continue; // product was deleted since the order was placed
      // Same rule as updateOrderStatus: supplier-synced stock (SPV-/PWH-) is the supplier's own number, so only
      // our own units go back there; ownStock always gets back exactly what this order took from it.
      const product = await tx.product.findUnique({ where: { id: item.productId }, select: { code: true } });
      const supplierSynced = !!product && (product.code.startsWith("SPV-") || product.code.startsWith("PWH-"));
      await tx.product.updateMany({
        where: { id: item.productId },
        data: {
          stock: { increment: supplierSynced ? item.ownStockTaken : item.qty },
          ownStock: { increment: item.ownStockTaken },
        },
      });
    }
    return true;
  });
}
