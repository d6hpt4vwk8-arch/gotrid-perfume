import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { formatPrice } from "@/lib/format";

// Orders in these statuses represent confirmed/collected money — excludes
// NEW (may still be an unpaid card order, see the "čeká na platbu" flag on
// the orders list) and CANCELLED/REFUNDED.
const REVENUE_STATUSES = ["PAID", "PROCESSING", "SHIPPED", "DELIVERED"] as const;

const LOW_STOCK_THRESHOLD = 5;

export default async function AdminDashboardPage() {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const [
    products,
    orders,
    newOrders,
    brands,
    categories,
    revenue,
    topSellers,
    lowStock,
  ] = await Promise.all([
    prisma.product.count(),
    prisma.order.count(),
    prisma.order.count({ where: { status: "NEW" } }),
    prisma.brand.count(),
    prisma.category.count(),
    prisma.order.aggregate({
      where: { status: { in: [...REVENUE_STATUSES] }, createdAt: { gte: thirtyDaysAgo } },
      _sum: { total: true },
      _count: true,
    }),
    prisma.product.findMany({
      where: { visible: true, salesCount: { gt: 0 } },
      orderBy: { salesCount: "desc" },
      take: 8,
      select: { id: true, name: true, salesCount: true, stock: true },
    }),
    prisma.product.findMany({
      where: { visible: true, stock: { gt: 0, lte: LOW_STOCK_THRESHOLD } },
      orderBy: { stock: "asc" },
      take: 10,
      select: { id: true, name: true, stock: true },
    }),
  ]);

  const stats = [
    { label: "Produkty", value: products, href: "/admin/produkty" },
    { label: "Nové objednávky", value: newOrders, href: "/admin/objednavky?status=NEW" },
    { label: "Objednávky celkem", value: orders, href: "/admin/objednavky" },
    { label: "Značky", value: brands, href: "/admin/znacky" },
    { label: "Kategorie", value: categories, href: "/admin/kategorie" },
  ];

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold text-ink">Přehled</h1>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-5">
        {stats.map((s) => (
          <Link
            key={s.label}
            href={s.href}
            className="rounded-sm border border-line bg-white p-4 hover:border-accent-2"
          >
            <div className="text-2xl font-bold text-ink">{s.value}</div>
            <div className="text-sm text-accent-2">{s.label}</div>
          </Link>
        ))}
      </div>

      <div className="rounded-sm border border-line bg-white p-4">
        <div className="text-sm text-accent-2">Výnos za posledních 30 dní</div>
        <div className="text-2xl font-bold text-ink">
          {formatPrice(revenue._sum.total ?? 0)}
        </div>
        <div className="text-xs text-accent-2">{revenue._count} zaplacených objednávek</div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="rounded-sm border border-line bg-white p-4">
          <h2 className="mb-3 font-semibold text-ink">Nejprodávanější</h2>
          {topSellers.length === 0 ? (
            <p className="text-sm text-accent-2">Zatím žádná prodejní historie.</p>
          ) : (
            <ul className="flex flex-col divide-y divide-line text-sm">
              {topSellers.map((p) => (
                <li key={p.id} className="flex items-center justify-between gap-3 py-2">
                  <Link href={`/admin/produkty/${p.id}`} className="truncate hover:underline">
                    {p.name}
                  </Link>
                  <span className="shrink-0 text-accent-2">
                    {p.salesCount} ks · sklad {p.stock}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="rounded-sm border border-line bg-white p-4">
          <h2 className="mb-3 font-semibold text-ink">Dochází na skladě</h2>
          {lowStock.length === 0 ? (
            <p className="text-sm text-accent-2">Žádné produkty pod {LOW_STOCK_THRESHOLD} ks.</p>
          ) : (
            <ul className="flex flex-col divide-y divide-line text-sm">
              {lowStock.map((p) => (
                <li key={p.id} className="flex items-center justify-between gap-3 py-2">
                  <Link href={`/admin/produkty/${p.id}`} className="truncate hover:underline">
                    {p.name}
                  </Link>
                  <span className="shrink-0 font-medium text-red-600">{p.stock} ks</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
