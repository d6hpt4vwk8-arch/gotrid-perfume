// Cancels the three Comgate test orders of 2026-10-23 and puts stock back exactly like updateOrderStatus does
// (supplier-synced products only get our own units back; ownStock uses OrderItem.ownStockTaken).
// GT261023-4655 was auto-cancelled by cancelUnpaidOrder, which restored `stock` but not `ownStock` — fix only ownStock there.
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();
const APPLY = process.argv.includes("--apply");

async function main() {
  const orders = await prisma.order.findMany({
    where: { number: { in: ["GT261023-4655", "GT261023-7089", "GT261023-1571"] } },
    include: { items: true },
  });
  for (const order of orders) {
    const alreadyCancelled = order.status === "CANCELLED";
    console.log(order.number, order.status, order.items.map((i) => `${i.qty}x ${i.name.slice(0, 30)} (own ${i.ownStockTaken})`).join("; "));
    if (!APPLY) continue;
    await prisma.$transaction(async (tx) => {
      if (!alreadyCancelled) await tx.order.update({ where: { id: order.id }, data: { status: "CANCELLED" } });
      for (const item of order.items) {
        if (!item.productId) continue;
        const product = await tx.product.findUnique({ where: { id: item.productId }, select: { code: true } });
        const synced = !!product && (product.code.startsWith("SPV-") || product.code.startsWith("PWH-"));
        await tx.product.update({
          where: { id: item.productId },
          data: {
            ...(alreadyCancelled ? {} : { stock: { increment: synced ? item.ownStockTaken : item.qty } }),
            ownStock: { increment: item.ownStockTaken },
          },
        });
      }
      await tx.adminActivityLog.create({
        data: { action: "order.status_change", entityType: "Order", entityId: order.id, detail: `${order.number}: ${order.status} → CANCELLED (Comgate test order, stock restored)` },
      });
    });
  }
  console.log(APPLY ? "applied" : "dry run (use --apply)");
}
main().finally(() => prisma.$disconnect());
