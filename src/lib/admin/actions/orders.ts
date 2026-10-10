"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { logAdminActivity } from "@/lib/admin/activity-log";
import { requireAdmin } from "@/lib/admin/require-admin";
import { sendHeurekaOrderLog } from "@/lib/analytics/heureka-overeno";
import { awardPointsForOrder } from "@/lib/loyalty";
import { sendShippedEmail } from "@/lib/email/send-shipped-email";
import type { OrderStatus } from "@prisma/client";

const VALID_STATUSES: OrderStatus[] = [
  "NEW",
  "PAID",
  "PROCESSING",
  "SHIPPED",
  "DELIVERED",
  "CANCELLED",
  "REFUNDED",
];

export async function updateOrderStatus(id: string, formData: FormData) {
  await requireAdmin();
  const status = String(formData.get("status") ?? "");
  const submittedTrackingNumber = String(formData.get("trackingNumber") ?? "").trim() || null;
  const weightRaw = String(formData.get("weight") ?? "").trim().replace(",", ".");
  const weight = weightRaw && Number(weightRaw) > 0 ? weightRaw : "0.5";
  if (!VALID_STATUSES.includes(status as OrderStatus)) {
    throw new Error("Neplatný stav objednávky.");
  }

  const before = await prisma.order.findUniqueOrThrow({ where: { id } });
  // A blank submission never clears an existing tracking number — it only
  // means the admin's form still had last page-load's (possibly stale)
  // value. Confirmed live 2026-09-25 on GT260923-3357: creating a GLS label
  // (which writes trackingNumber directly) and then submitting this same
  // page's status dropdown ~20s later, before the page had reloaded to show
  // the new number, blanked it right back out. A carrier label is the only
  // way trackingNumber gets set in the first place, so there's no legitimate
  // reason for this form to null out a number that's already there.
  const trackingNumber = submittedTrackingNumber ?? before.trackingNumber;
  const order = await prisma.order.update({
    where: { id },
    data: {
      status: status as OrderStatus,
      trackingNumber,
      weight,
      // Only stamped the first time — a later unrelated edit (tracking
      // number, weight) must not shift the dobropis's dated reference.
      ...(before.status !== "REFUNDED" && status === "REFUNDED"
        ? { refundedAt: new Date() }
        : {}),
      // Same first-transition-only stamping, anchors the review-request
      // email's "N days after delivery" wait (see review-request-campaign.ts).
      ...(before.status !== "DELIVERED" && status === "DELIVERED"
        ? { deliveredAt: new Date() }
        : {}),
    },
    include: { items: true },
  });

  if (before.status !== order.status) {
    await logAdminActivity({
      action: "order.status_change",
      entityType: "Order",
      entityId: id,
      detail: `${order.number}: ${before.status} → ${order.status}`,
    });

    // Neither stock (supplier-fed) nor ownStock used to be touched at all on
    // cancel/refund — an unpaid/unclaimed COD order silently kept both
    // numbers permanently short, as if the goods had actually shipped.
    // Restore both the first time an order enters a reversed state, and
    // re-take them if it's reactivated afterward (status bounced back to an
    // active one) — symmetric, so bouncing CANCELLED -> PROCESSING -> ... a
    // second time doesn't double-credit or double-charge the inventory.
    // ownStock uses the exact amount recorded on each OrderItem
    // (ownStockTaken) rather than the product's current ownStock, which may
    // have changed for unrelated reasons since the order was placed.
    const wasReversed = before.status === "CANCELLED" || before.status === "REFUNDED";
    const isReversed = order.status === "CANCELLED" || order.status === "REFUNDED";
    if (wasReversed !== isReversed) {
      const sign = isReversed ? 1 : -1;
      for (const item of order.items) {
        if (!item.productId) continue;
        // `stock` of supplier-synced products (SPV-/PWH- codes) is the
        // supplier's own number, rewritten by the daily sync. Crediting the
        // cancelled qty back would invent a unit the supplier may no longer
        // have (2026-10-10: a cancelled order for a sold-out SPV perfume put
        // it back on the shop as "Skladem (1 ks)"). Only our own units are
        // restored there; the sync reports the supplier's real number.
        const product = await prisma.product.findUnique({ where: { id: item.productId }, select: { code: true } });
        const supplierSynced = !!product && (product.code.startsWith("SPV-") || product.code.startsWith("PWH-"));
        await prisma.product.update({
          where: { id: item.productId },
          data: {
            stock: { increment: sign * (supplierSynced ? item.ownStockTaken : item.qty) },
            ownStock: { increment: sign * item.ownStockTaken },
          },
        });
      }
    }

    // COD/bank-transfer orders have no payment webhook to confirm them —
    // the admin moving one past NEW here *is* the confirmation (see
    // canDownloadInvoice's reasoning in status-labels.ts). CARD orders are
    // reported from the Stripe webhook instead, right when
    // checkout.session.completed actually confirms payment.
    if (
      order.paymentMethod !== "CARD" &&
      before.status === "NEW" &&
      order.status !== "CANCELLED"
    ) {
      void sendHeurekaOrderLog({
        orderId: order.number,
        email: order.email,
        items: order.items.map((i) => ({
          productId: i.productId,
          name: i.name,
          ean: i.ean,
          qty: i.qty,
          unitPrice: Number(i.unitPrice),
        })),
      }).catch((err) => console.error(`[heureka-overeno] failed for ${order.number}`, err));

      void awardPointsForOrder(order.id).catch((err) =>
        console.error(`[loyalty] award failed for ${order.number}`, err),
      );
    }

    if (before.status !== "SHIPPED" && order.status === "SHIPPED") {
      void sendShippedEmail(order).catch((err) =>
        console.error(`[email] shipped notification failed for ${order.number}`, err),
      );
    }
  }
  if (before.trackingNumber !== order.trackingNumber) {
    await logAdminActivity({
      action: "order.tracking_change",
      entityType: "Order",
      entityId: id,
      detail: `${order.number}: sledovací číslo nastaveno na "${order.trackingNumber ?? ""}"`,
    });
  }

  revalidatePath("/admin/objednavky");
  revalidatePath(`/admin/objednavky/${id}`);
  revalidatePath(`/objednavka/${order.number}`);
}
