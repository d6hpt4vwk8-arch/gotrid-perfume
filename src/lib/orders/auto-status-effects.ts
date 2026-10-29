import { prisma } from "@/lib/prisma";
import { sendHeurekaOrderLog } from "@/lib/analytics/heureka-overeno";
import { awardPointsForOrder } from "@/lib/loyalty";

/**
 * What updateOrderStatus (admin) does when a COD / bank-transfer order leaves
 * NEW: report the purchase to Heureka "Ověřeno zákazníky" (which triggers the
 * customer questionnaire) and award loyalty points. The carrier delivery syncs
 * write the status straight to the database, so without this an order that the
 * owner kept at NEW until delivery, and that the sync then marked DELIVERED,
 * would never reach Heureka and never earn points. CARD orders are reported
 * from the Stripe webhook instead, so they are skipped here.
 */
export async function runLeftNewEffects(orderId: string): Promise<void> {
  const order = await prisma.order.findUnique({ where: { id: orderId }, include: { items: true } });
  if (!order || order.paymentMethod === "CARD") return;

  try {
    await sendHeurekaOrderLog({
      orderId: order.number,
      email: order.email,
      country: order.shippingCountry,
      items: order.items.map((i) => ({
        productId: i.productId,
        name: i.name,
        ean: i.ean,
        qty: i.qty,
        unitPrice: Number(i.unitPrice),
      })),
    });
  } catch (err) {
    console.error(`[heureka-overeno] failed for ${order.number}`, err);
  }
  try {
    await awardPointsForOrder(order.id);
  } catch (err) {
    console.error(`[loyalty] award failed for ${order.number}`, err);
  }
}
