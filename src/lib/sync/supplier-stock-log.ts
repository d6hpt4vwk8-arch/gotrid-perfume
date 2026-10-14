import { prisma } from "@/lib/prisma";

export type SupplierLogRow = { productId: string; supplierStock: number; purchasePrice: number };

/**
 * Collects SupplierStockLog rows during a sync run. A row is queued only when
 * the supplier's own number or wholesale price differs from the last row we
 * stored for that product (or there is none yet — the baseline), so quiet
 * products cost nothing. Call `flush()` once after the loop.
 */
export async function createSupplierLogRecorder() {
  // `distinct` keeps the first row per product in the given order, i.e. the newest.
  const lastLogs = await prisma.supplierStockLog.findMany({
    orderBy: { createdAt: "desc" },
    distinct: ["productId"],
    select: { productId: true, supplierStock: true, purchasePrice: true },
  });
  const lastByProduct = new Map(lastLogs.map((l) => [l.productId, l]));
  const rows: SupplierLogRow[] = [];

  return {
    record(productId: string, supplierStock: number, purchasePrice: number) {
      const last = lastByProduct.get(productId);
      if (!last || last.supplierStock !== supplierStock || Number(last.purchasePrice) !== purchasePrice) {
        rows.push({ productId, supplierStock, purchasePrice });
      }
    },
    async flush() {
      if (rows.length > 0) await prisma.supplierStockLog.createMany({ data: rows });
    },
  };
}

/** Keeps the table small: history older than this has no use for the trend view. */
export async function pruneSupplierLog(days = 180) {
  await prisma.supplierStockLog.deleteMany({
    where: { createdAt: { lt: new Date(Date.now() - days * 24 * 60 * 60 * 1000) } },
  });
}
