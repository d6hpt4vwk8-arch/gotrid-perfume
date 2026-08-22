import { prisma } from "@/lib/prisma";
import { logAdminActivity } from "@/lib/admin/activity-log";
import { getPacketStatus, PACKETA_DELIVERED_STATUS_CODE } from "@/lib/packeta";

/**
 * Marks orders as DELIVERED once Zásilkovna confirms the customer picked up
 * the packet — Packeta itself only syncs with branches ~3x/day, so once a
 * day is plenty (see docs.packeta.com/docs/packet-tracking/tracking).
 */
export async function syncPacketaDeliveryStatus(): Promise<{ checked: number; delivered: number }> {
  const orders = await prisma.order.findMany({
    where: {
      packetaId: { not: null },
      status: { notIn: ["DELIVERED", "CANCELLED", "REFUNDED"] },
    },
    select: { id: true, number: true, packetaId: true },
  });

  let delivered = 0;
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
    }
  }

  return { checked: orders.length, delivered };
}
