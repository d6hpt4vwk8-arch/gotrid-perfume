import { prisma } from "@/lib/prisma";

const DAY = 24 * 60 * 60 * 1000;
// Supplier-fed catalogs we keep a stock history for (SupplierStockLog is written by their syncs).
const SUPPLIER_PREFIXES = ["SPV-", "TDE-"];
const supplierCodeFilter = { OR: SUPPLIER_PREFIXES.map((prefix) => ({ code: { startsWith: prefix } })) };

type LogPoint = { supplierStock: number; purchasePrice: number; createdAt: Date };

/** Supplier stock as it stood at `at` — the newest snapshot not after it, or null if history starts later. */
function stockAt(logs: LogPoint[], at: Date): number | null {
  let found: LogPoint | null = null;
  for (const l of logs) {
    if (l.createdAt <= at) found = l;
    else break;
  }
  return found ? found.supplierStock : null;
}

export interface SupplierWatchRow {
  product: {
    id: string;
    code: string;
    name: string;
    stock: number;
    ownStock: number;
    price: number;
    purchasePrice: number;
    visible: boolean;
    slowerDelivery: boolean;
  };
  sold30: number;
  sold60: number;
  supplierNow: number;
  s1: number | null;
  s7: number | null;
  delta7: number | null;
  perDay: number | null;
  daysLeft: number | null;
  cost: number;
  costChange: number | null;
  costUp: boolean;
  falling: boolean;
  low: boolean;
}

/**
 * Supplier-side trend for the goods we sell (sold in the last 60 days) or hold
 * ourselves, plus any `extraIds` (admin search hits). "Falling" = supplier stock
 * dropped ≥ 20 % in 7 days; "low" = ≤ 10 left while we still sell it; "costUp" =
 * wholesale price ≥ 5 % above the oldest snapshot in the last 30 days.
 */
export async function loadSupplierWatch(extraIds: string[] = []): Promise<{ rows: SupplierWatchRow[]; firstLogAt: Date | null }> {
  const now = new Date();
  const since60 = new Date(now.getTime() - 60 * DAY);
  const since30 = new Date(now.getTime() - 30 * DAY);

  const soldItems = await prisma.orderItem.findMany({
    where: {
      isGift: false,
      productId: { not: null },
      product: supplierCodeFilter,
      order: { createdAt: { gte: since60 }, status: { notIn: ["CANCELLED", "REFUNDED"] } },
    },
    select: { productId: true, qty: true, order: { select: { createdAt: true } } },
  });
  const sold30 = new Map<string, number>();
  const sold60 = new Map<string, number>();
  for (const i of soldItems) {
    const id = i.productId!;
    sold60.set(id, (sold60.get(id) ?? 0) + i.qty);
    if (i.order.createdAt >= since30) sold30.set(id, (sold30.get(id) ?? 0) + i.qty);
  }

  const ownStockProducts = await prisma.product.findMany({
    where: { ...supplierCodeFilter, ownStock: { gt: 0 } },
    select: { id: true },
  });
  const ids = [...new Set([...sold60.keys(), ...extraIds, ...ownStockProducts.map((p) => p.id)])];

  const [products, logRows, firstLog] = await Promise.all([
    prisma.product.findMany({
      where: { id: { in: ids } },
      select: { id: true, code: true, name: true, stock: true, ownStock: true, price: true, purchasePrice: true, visible: true, slowerDelivery: true },
    }),
    prisma.supplierStockLog.findMany({
      where: { productId: { in: ids } },
      orderBy: { createdAt: "asc" },
      select: { productId: true, supplierStock: true, purchasePrice: true, createdAt: true },
    }),
    prisma.supplierStockLog.findFirst({ orderBy: { createdAt: "asc" }, select: { createdAt: true } }),
  ]);

  const logsByProduct = new Map<string, LogPoint[]>();
  for (const l of logRows) {
    const arr = logsByProduct.get(l.productId) ?? [];
    arr.push({ supplierStock: l.supplierStock, purchasePrice: Number(l.purchasePrice), createdAt: l.createdAt });
    logsByProduct.set(l.productId, arr);
  }

  const rows = products
    .map((p): SupplierWatchRow => {
      const logs = logsByProduct.get(p.id) ?? [];
      const last = logs.length > 0 ? logs[logs.length - 1] : null;
      const supplierNow = last ? last.supplierStock : p.stock;
      const s1 = stockAt(logs, new Date(now.getTime() - DAY));
      const s7 = stockAt(logs, new Date(now.getTime() - 7 * DAY));
      const delta7 = s7 !== null ? supplierNow - s7 : null;
      const firstPoint = logs[0] ?? null;
      const elapsedDays = firstPoint ? Math.min(7, Math.max(1, (now.getTime() - firstPoint.createdAt.getTime()) / DAY)) : null;
      const perDay = delta7 !== null && delta7 < 0 && elapsedDays ? -delta7 / elapsedDays : null;
      const daysLeft = perDay && perDay > 0 ? Math.round(supplierNow / perDay) : null;
      const cost = Number(p.purchasePrice);
      const cost30 = logs.find((l) => l.createdAt >= since30)?.purchasePrice ?? firstPoint?.purchasePrice ?? null;
      return {
        product: { ...p, price: Number(p.price), purchasePrice: cost },
        sold30: sold30.get(p.id) ?? 0,
        sold60: sold60.get(p.id) ?? 0,
        supplierNow,
        s1,
        s7,
        delta7,
        perDay,
        daysLeft,
        cost,
        costChange: cost30 !== null ? cost - cost30 : null,
        costUp: cost30 !== null && cost30 > 0 && cost >= cost30 * 1.05,
        falling: s7 !== null && s7 >= 20 && delta7 !== null && delta7 <= -0.2 * s7,
        low: supplierNow <= 10 && (sold30.get(p.id) ?? 0) > 0,
      };
    })
    .sort((a, b) => b.sold30 - a.sold30 || b.sold60 - a.sold60 || a.product.name.localeCompare(b.product.name, "cs"));

  return { rows, firstLogAt: firstLog?.createdAt ?? null };
}

export { supplierCodeFilter };
