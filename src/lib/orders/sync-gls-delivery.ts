import { prisma } from "@/lib/prisma";
import { logAdminActivity } from "@/lib/admin/activity-log";
import { getParcelStatuses, GLS_DELIVERED_STATUS_CODES, GLS_RETURNED_STATUS_CODES } from "@/lib/gls";
import { runLeftNewEffects } from "@/lib/orders/auto-status-effects";

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * GetParcelListStatuses fails the whole call if a single number is not
 * readable by our account ("[5] Access denied for this parcel ID") and
 * rate-limits quickly ("[59] Too many requests"). One such number used to
 * stop every GLS order from ever being marked delivered (found 2026-10-16:
 * GLS had delivered parcels that were still SHIPPED/NEW). So: one batch call
 * first; if it fails for any reason other than the rate limit, read the
 * parcels one at a time — 2.5 s apart, which stayed under the limit in a live
 * test — and skip the unreadable ones. Capped so the daily cron (300 s limit)
 * can never run out of time; the most recent parcels are read first.
 */
export async function getStatusesTolerant(numbers: string[]) {
  const out = new Map<string, { statusCode: string; statusDescription: string }>();
  try {
    for (const [number, status] of await getParcelStatuses(numbers)) out.set(number, status);
    return out;
  } catch {
    // fall through to the one-by-one pass
  }
  const newestFirst = [...numbers].reverse().slice(0, 60);
  for (const number of newestFirst) {
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        for (const [n, status] of await getParcelStatuses([number])) out.set(n, status);
        break;
      } catch (err) {
        if (!/\[59\]|too many requests/i.test(String(err))) break; // unreadable: skip it
        await sleep(12000);
      }
    }
    await sleep(2500);
  }
  return out;
}

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
    select: { id: true, number: true, glsParcelNumber: true, status: true },
  });
  if (orders.length === 0) return { checked: 0, delivered: 0, returned: 0 };

  const statuses = await getStatusesTolerant(orders.map((o) => o.glsParcelNumber!));

  let delivered = 0;
  let returned = 0;
  for (const order of orders) {
    const status = statuses.get(order.glsParcelNumber!);
    if (!status) continue;
    if (GLS_DELIVERED_STATUS_CODES.includes(status.statusCode)) {
      await prisma.order.update({
        where: { id: order.id },
        data: { status: "DELIVERED", deliveredAt: new Date() },
      });
      await logAdminActivity({
        action: "order.auto_delivered",
        entityType: "Order",
        entityId: order.id,
        detail: `${order.number}: automaticky označeno jako Doručeno (GLS: ${status.statusDescription})`,
      });
      // Same as a manual NEW -> anything change for COD / bank transfer.
      if (order.status === "NEW") await runLeftNewEffects(order.id);
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
