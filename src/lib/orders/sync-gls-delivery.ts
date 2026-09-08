import { prisma } from "@/lib/prisma";
import { logAdminActivity } from "@/lib/admin/activity-log";
import { getParcelStatuses, GLS_DELIVERED_STATUS_CODE, GLS_RETURNED_STATUS_CODES } from "@/lib/gls";

/**
 * Marks orders as DELIVERED once GLS's own tracking confirms delivery
 * (status code 5), or REFUNDED ("Vrácená" — reused here for "returned by
 * the carrier", not a money refund) once it confirms the parcel was
 * returned to sender (codes 23/40 — see Appendix G of the MyGLS API docs).
 * The latter is the terminal state for a GLS_MISTO parcel nobody picked up
 * from the ParcelShop/Box within the storage window.
 */
export async function syncGlsDeliveryStatus(): Promise<{
  checked: number;
  delivered: number;
  returned: number;
}> {
  const orders = await prisma.order.findMany({
    where: {
      glsParcelNumber: { not: null },
      status: { notIn: ["DELIVERED", "CANCELLED", "REFUNDED"] },
    },
    select: { id: true, number: true, glsParcelNumber: true },
  });
  if (orders.length === 0) return { checked: 0, delivered: 0, returned: 0 };

  let statuses: Map<string, { statusCode: string; statusDescription: string }>;
  try {
    statuses = await getParcelStatuses(orders.map((o) => o.glsParcelNumber!));
  } catch (err) {
    console.error("[gls-delivery-sync] failed to fetch statuses", err);
    return { checked: orders.length, delivered: 0, returned: 0 };
  }

  let delivered = 0;
  let returned = 0;
  for (const order of orders) {
    const status = statuses.get(order.glsParcelNumber!);
    if (!status) continue;
    if (status.statusCode === GLS_DELIVERED_STATUS_CODE) {
      await prisma.order.update({ where: { id: order.id }, data: { status: "DELIVERED" } });
      await logAdminActivity({
        action: "order.auto_delivered",
        entityType: "Order",
        entityId: order.id,
        detail: `${order.number}: automaticky označeno jako Doručeno (GLS: ${status.statusDescription})`,
      });
      delivered++;
    } else if (GLS_RETURNED_STATUS_CODES.includes(status.statusCode)) {
      await prisma.order.update({ where: { id: order.id }, data: { status: "REFUNDED" } });
      await logAdminActivity({
        action: "order.auto_returned",
        entityType: "Order",
        entityId: order.id,
        detail: `${order.number}: automaticky označeno jako Vráceno — zásilku si zákazník nevyzvedl (GLS: ${status.statusDescription})`,
      });
      returned++;
    }
  }

  return { checked: orders.length, delivered, returned };
}
