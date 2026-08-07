"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { logAdminActivity } from "@/lib/admin/activity-log";
import { requireAdmin } from "@/lib/admin/require-admin";
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
  const trackingNumber = String(formData.get("trackingNumber") ?? "").trim() || null;
  if (!VALID_STATUSES.includes(status as OrderStatus)) {
    throw new Error("Neplatný stav objednávky.");
  }

  const before = await prisma.order.findUniqueOrThrow({ where: { id } });
  const order = await prisma.order.update({
    where: { id },
    data: { status: status as OrderStatus, trackingNumber },
  });

  if (before.status !== order.status) {
    await logAdminActivity({
      action: "order.status_change",
      entityType: "Order",
      entityId: id,
      detail: `${order.number}: ${before.status} → ${order.status}`,
    });
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
