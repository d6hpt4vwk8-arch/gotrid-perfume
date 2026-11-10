import { prisma } from "@/lib/prisma";
import { sendHeurekaOrderLog } from "@/lib/analytics/heureka-overeno";
import { awardPointsForOrder } from "@/lib/loyalty";
import { sendInvoiceEmail } from "@/lib/email/send-invoice-email";
import { isCompanyOrder } from "@/lib/email/invoice-attachment";

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

/**
 * A company needs its faktura for the books. For a card/bank-transfer order the shipped e-mail carries it, but only when
 * the owner moved the order to SHIPPED by hand; a COD order's shipped e-mail never does (nothing was paid yet). When the
 * carrier sync marks such an order DELIVERED without that e-mail having gone out, send the faktura now so a company
 * never has to ask for it (GT261105-6656, 2026-11-10).
 */
export async function runDeliveredEffects(orderId: string, previousStatus: string): Promise<void> {
  try {
    const order = await prisma.order.findUnique({ where: { id: orderId } });
    if (!order || !isCompanyOrder(order)) return;
    const shippedEmailCarriedInvoice = previousStatus === "SHIPPED" && order.paymentMethod !== "CASH_ON_DELIVERY";
    if (shippedEmailCarriedInvoice) return;
    await sendInvoiceEmail(order);
    await prisma.adminActivityLog.create({
      data: {
        action: "order.invoice_emailed",
        entityType: "Order",
        entityId: order.id,
        detail: `${order.number}: faktura odeslána e-mailem na ${order.email} (automaticky při doručení)`,
      },
    });
  } catch (err) {
    console.error(`[delivered-effects] invoice e-mail failed for order ${orderId}`, err);
  }
}
