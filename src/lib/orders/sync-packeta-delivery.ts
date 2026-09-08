import { prisma } from "@/lib/prisma";
import { logAdminActivity } from "@/lib/admin/activity-log";
import {
  getPacketStatus,
  PACKETA_DELIVERED_STATUS_CODE,
  PACKETA_RETURNED_STATUS_CODE,
} from "@/lib/packeta";

/**
 * Marks orders as DELIVERED once Zásilkovna confirms the customer picked up
 * the packet, or REFUNDED ("Vrácená" — reused here for "returned by the
 * carrier", not a money refund) once it confirms the packet was sent back
 * because nobody picked it up within the branch's storage window. Packeta
 * itself only syncs with branches ~3x/day, so once a day is plenty (see
 * docs.packeta.com/docs/packet-tracking/tracking).
 */
export async function syncPacketaDeliveryStatus(): Promise<{
  checked: number;
  delivered: number;
  returned: number;
}> {
  const orders = await prisma.order.findMany({
    where: {
      packetaId: { not: null },
      status: { notIn: ["DELIVERED", "CANCELLED", "REFUNDED"] },
    },
    select: { id: true, number: true, packetaId: true },
  });

  let delivered = 0;
  let returned = 0;
  for (const order of orders) {
    let status: { statusCode: string; codeText: string };
    try {
      status = await getPacketStatus(order.packetaId!);
    } catch (err) {
      console.error(`[packeta-delivery-sync] failed for order ${order.number}`, err);
      continue;
    }

    if (status.statusCode === PACKETA_DELIVERED_STATUS_CODE) {
      await prisma.order.update({ where: { id: order.id }, data: { status: "DELIVERED" } });
      await logAdminActivity({
        action: "order.auto_delivered",
        entityType: "Order",
        entityId: order.id,
        detail: `${order.number}: automaticky označeno jako Doručeno (Zásilkovna: ${status.codeText})`,
      });
      delivered++;
    } else if (status.statusCode === PACKETA_RETURNED_STATUS_CODE) {
      await prisma.order.update({ where: { id: order.id }, data: { status: "REFUNDED" } });
      await logAdminActivity({
        action: "order.auto_returned",
        entityType: "Order",
        entityId: order.id,
        detail: `${order.number}: automaticky označeno jako Vráceno — zásilku si zákazník nevyzvedl (Zásilkovna: ${status.codeText})`,
      });
      returned++;
    }
  }

  return { checked: orders.length, delivered, returned };
}
