import type { Product } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { sendStockAlertEmail } from "@/lib/email/send-stock-alert-email";

// Fired when an admin edit brings a product's stock from 0 back above 0.
// Best-effort per recipient — one bad email address must not block the rest.
export async function notifyStockAlerts(product: Product): Promise<void> {
  const pending = await prisma.stockAlert.findMany({
    where: { productId: product.id, notified: false },
  });
  if (pending.length === 0) return;

  for (const alert of pending) {
    try {
      await sendStockAlertEmail(alert.email, product);
      await prisma.stockAlert.update({ where: { id: alert.id }, data: { notified: true } });
    } catch (err) {
      console.error(`[stock-alert] failed to notify ${alert.email} for ${product.slug}`, err);
    }
  }
}
