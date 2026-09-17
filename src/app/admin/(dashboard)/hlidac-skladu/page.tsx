import Link from "next/link";
import { prisma } from "@/lib/prisma";

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-sm border border-line bg-white p-4">
      <span className="block text-xs uppercase text-accent-2">{label}</span>
      <span className="block text-2xl font-bold text-ink">{value}</span>
    </div>
  );
}

// "Notify me when back in stock" (StockAlertForm on the product page) — this
// page answers two things the owner asked for directly: does it actually
// fire (Notifikováno below is the proof — see also notifyStockAlerts' three
// call sites: manual admin restock, SP Venture sync, perfumes-wholesale.eu
// sync, and now the XLSX import too), and what are people waiting for most,
// grouped by product and sorted by how many are still waiting.
export default async function AdminStockWatchPage() {
  const [total, pendingTotal, notifiedTotal, grouped] = await Promise.all([
    prisma.stockAlert.count(),
    prisma.stockAlert.count({ where: { notified: false } }),
    prisma.stockAlert.count({ where: { notified: true } }),
    prisma.stockAlert.groupBy({
      by: ["productId"],
      _count: { _all: true },
      orderBy: { _count: { productId: "desc" } },
    }),
  ]);

  const productIds = grouped.map((g) => g.productId);
  const products = await prisma.product.findMany({
    where: { id: { in: productIds } },
    select: { id: true, name: true, code: true, stock: true, visible: true },
  });
  const productById = new Map(products.map((p) => [p.id, p]));

  const pendingByProduct = await prisma.stockAlert.groupBy({
    by: ["productId"],
    where: { notified: false },
    _count: { _all: true },
  });
  const pendingCountByProduct = new Map(pendingByProduct.map((p) => [p.productId, p._count._all]));

  const rows = grouped
    .map((g) => ({
      product: productById.get(g.productId),
      total: g._count._all,
      pending: pendingCountByProduct.get(g.productId) ?? 0,
    }))
    .filter((r) => r.product)
    .sort((a, b) => b.pending - a.pending || b.total - a.total);

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-bold text-ink">Hlídání skladem</h1>
        <p className="text-sm text-accent-2">
          Kdo čeká na e-mail „dejte vědět, až bude skladem“ z karty produktu — a na co lidé čekají
          nejvíc.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <StatCard label="Přihlášeno celkem" value={total} />
        <StatCard label="Čeká na doskladnění" value={pendingTotal} />
        <StatCard label="Už notifikováno" value={notifiedTotal} />
      </div>

      <div className="overflow-x-auto rounded-sm border border-line bg-white">
        <table className="w-full min-w-[700px] text-sm">
          <thead className="border-b border-line bg-white text-left text-xs uppercase text-accent-2">
            <tr>
              <th className="px-3 py-2">Produkt</th>
              <th className="px-3 py-2">Sklad nyní</th>
              <th className="px-3 py-2">Čeká</th>
              <th className="px-3 py-2">Celkem přihlášeno</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.product!.id} className="border-b border-line last:border-0">
                <td className="px-3 py-2">
                  <Link href={`/admin/produkty/${r.product!.id}`} className="underline hover:text-accent">
                    {r.product!.name}
                  </Link>
                  <div className="text-xs text-accent-2">{r.product!.code}</div>
                </td>
                <td className="px-3 py-2">
                  {r.product!.stock > 0 ? (
                    <span className="text-ok">{r.product!.stock} ks</span>
                  ) : (
                    <span className="text-red-600">vyprodáno</span>
                  )}
                  {!r.product!.visible && <span className="ml-1.5 text-accent-2">(skryto)</span>}
                </td>
                <td className="px-3 py-2 font-medium">{r.pending > 0 ? r.pending : "—"}</td>
                <td className="px-3 py-2 text-accent-2">{r.total}</td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={4} className="px-3 py-4 text-center text-accent-2">
                  Zatím se nikdo nepřihlásil k hlídání skladem.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
