import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

const DAY = 24 * 60 * 60 * 1000;

export type SupplierChange = {
  productId: string;
  code: string;
  name: string;
  at: Date;
  stock: number;
  prevStock: number;
  price: number;
  prevPrice: number;
  /** wholesale price change in percent, 0 when the price did not move */
  pricePct: number;
  priceChanged: boolean;
  stockChanged: boolean;
};

export type SupplierChangeSummary = {
  trackedProducts: number;
  priceChanged: number;
  priceUp: number;
  priceDown: number;
  medianUpPct: number | null;
  bigRestocks: number;
  bigDrops: number;
};

type RawChange = {
  productId: string;
  createdAt: Date;
  stock: number;
  prevStock: number | null;
  price: number;
  prevPrice: number | null;
};

/**
 * Every change the supplier syncs recorded in the last `days` days, as
 * (previous row → this row) pairs. A SupplierStockLog row is only written when
 * the supplier's stock or wholesale price moved, so each pair is one change.
 * A "big" restock/drop is ≥ 50 units and ≥ 50 % from the previous number.
 */
export async function loadSupplierChanges(days: number): Promise<{ changes: SupplierChange[]; summary: SupplierChangeSummary }> {
  const since = new Date(Date.now() - days * DAY);
  // The window function needs the row before the first in-window one, so look a bit further back.
  const lookback = new Date(since.getTime() - 30 * DAY);

  const raw = await prisma.$queryRaw<RawChange[]>(Prisma.sql`
    select t."productId", t."createdAt", t.stock, t."prevStock", t.price, t."prevPrice"
    from (
      select l."productId", l."createdAt",
             l."supplierStock" as stock,
             lag(l."supplierStock") over w as "prevStock",
             l."purchasePrice"::float8 as price,
             lag(l."purchasePrice"::float8) over w as "prevPrice"
      from "SupplierStockLog" l
      where l."createdAt" >= ${lookback}
      window w as (partition by l."productId" order by l."createdAt")
    ) t
    where t."createdAt" >= ${since} and t."prevStock" is not null
    order by t."createdAt" desc
  `);

  const ids = [...new Set(raw.map((r) => r.productId))];
  const products = await prisma.product.findMany({ where: { id: { in: ids } }, select: { id: true, code: true, name: true } });
  const byId = new Map(products.map((p) => [p.id, p]));

  const changes: SupplierChange[] = raw.map((r) => {
    const p = byId.get(r.productId);
    const prevPrice = r.prevPrice ?? r.price;
    const priceChanged = Math.abs(r.price - prevPrice) > 0.004;
    return {
      productId: r.productId,
      code: p?.code ?? "?",
      name: p?.name ?? "(smazaný produkt)",
      at: r.createdAt,
      stock: r.stock,
      prevStock: r.prevStock ?? r.stock,
      price: r.price,
      prevPrice,
      pricePct: priceChanged && prevPrice > 0 ? (r.price / prevPrice - 1) * 100 : 0,
      priceChanged,
      stockChanged: r.stock !== (r.prevStock ?? r.stock),
    };
  });

  const trackedProducts = await prisma.supplierStockLog.groupBy({ by: ["productId"], where: { createdAt: { gte: lookback } } }).then((g) => g.length);
  const priceChanges = changes.filter((c) => c.priceChanged);
  const ups = priceChanges.filter((c) => c.pricePct > 0).map((c) => c.pricePct).sort((a, b) => a - b);
  const summary: SupplierChangeSummary = {
    trackedProducts,
    priceChanged: new Set(priceChanges.map((c) => c.productId)).size,
    priceUp: priceChanges.filter((c) => c.pricePct > 0).length,
    priceDown: priceChanges.filter((c) => c.pricePct < 0).length,
    medianUpPct: ups.length > 0 ? ups[Math.floor(ups.length / 2)] : null,
    bigRestocks: changes.filter((c) => c.stockChanged && c.stock - c.prevStock >= 50 && c.stock >= c.prevStock * 1.5).length,
    bigDrops: changes.filter((c) => c.stockChanged && c.prevStock - c.stock >= 50 && c.stock <= c.prevStock * 0.6).length,
  };
  return { changes, summary };
}

export type ProductHistoryPoint = { at: Date; stock: number; price: number };

/** The product's stored supplier history, oldest first (the sync keeps ~180 days). */
export async function loadProductHistory(productId: string) {
  const [product, logs] = await Promise.all([
    prisma.product.findUnique({
      where: { id: productId },
      select: { id: true, code: true, name: true, stock: true, ownStock: true, price: true, purchasePrice: true, slowerDelivery: true, visible: true },
    }),
    prisma.supplierStockLog.findMany({
      where: { productId },
      orderBy: { createdAt: "asc" },
      select: { supplierStock: true, purchasePrice: true, createdAt: true },
    }),
  ]);
  const points: ProductHistoryPoint[] = logs.map((l) => ({ at: l.createdAt, stock: l.supplierStock, price: Number(l.purchasePrice) }));
  return { product, points };
}
