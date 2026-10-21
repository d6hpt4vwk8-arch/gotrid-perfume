import { getShippingCost } from "@/lib/shipping";
import { purchaseCost } from "@/lib/cost-of-goods";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { formatPrice } from "@/lib/format";
import { getSettings } from "@/lib/settings.server";

// Orders in these statuses represent confirmed/collected money — excludes
// NEW (may still be an unpaid card order, see the "čeká na platbu" flag on
// the orders list) and CANCELLED/REFUNDED.
const REVENUE_STATUSES = ["PAID", "PROCESSING", "SHIPPED", "DELIVERED"] as const;

const LOW_STOCK_THRESHOLD = 5;

// "Today" for the shop owner means the Prague calendar day, not UTC — a UTC
// midnight cut would split the evening's orders onto the wrong day.
function startOfPragueDay(daysAgo = 0): Date {
  const tz = "Europe/Prague";
  const ymd = new Intl.DateTimeFormat("en-CA", { timeZone: tz }).format(new Date()); // YYYY-MM-DD
  const [y, m, d] = ymd.split("-").map(Number);
  const utcGuess = Date.UTC(y, m - 1, d - daysAgo);
  // Offset of Prague at that instant (CET/CEST): read the guess back as Prague wall-clock
  // parts and compare in UTC, so the result doesn't depend on the host's own timezone.
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      hourCycle: "h23",
      year: "numeric",
      month: "numeric",
      day: "numeric",
      hour: "numeric",
      minute: "numeric",
      second: "numeric",
    })
      .formatToParts(new Date(utcGuess))
      .map((x) => [x.type, Number(x.value)]),
  ) as Record<string, number>;
  const offsetMs = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second) - utcGuess;
  return new Date(utcGuess - offsetMs);
}

// For the daily figures, COD and bank-transfer orders count from the moment they
// are placed (they sit in NEW until shipped/paid, so REVENUE_STATUSES alone would
// hide most of a busy day). Only unconfirmed card orders stay out (they may be abandoned).
const DAY_ORDER_FILTER = {
  OR: [
    { status: { in: [...REVENUE_STATUSES] } },
    { status: "NEW" as const, paymentMethod: { not: "CARD" as const } },
  ],
};

export default async function AdminDashboardPage() {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const [
    products,
    orders,
    newOrders,
    brands,
    categories,
    revenue,
    ordersForProfit,
    settings,
    topSellers,
    lowStock,
    pendingReviews,
    todayOrders,
    yesterdayOrders,
    todayUnconfirmed,
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
    // Same window/status filter as revenue above — items+purchasePrice and
    // shippingMethod are the two extra things needed for the net-profit
    // figure, same formula as the order detail page (see there for caveats:
    // current purchasePrice, no card-fee deduction).
    prisma.order.findMany({
      where: { status: { in: [...REVENUE_STATUSES] }, createdAt: { gte: thirtyDaysAgo } },
      select: {
        total: true,
        shippingMethod: true,
        shippingCountry: true,
        paymentMethod: true,
        items: { select: { qty: true, isGift: true, product: { select: { purchasePrice: true, vatRate: true } } } },
      },
    }),
    getSettings(),
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
    prisma.review.count({ where: { published: false } }),
    prisma.order.findMany({
      where: { ...DAY_ORDER_FILTER, createdAt: { gte: startOfPragueDay(0) } },
      select: {
        total: true,
        shippingMethod: true,
        shippingCountry: true,
        paymentMethod: true,
        items: { select: { qty: true, isGift: true, product: { select: { purchasePrice: true, vatRate: true } } } },
      },
    }),
    prisma.order.findMany({
      where: {
        ...DAY_ORDER_FILTER,
        createdAt: { gte: startOfPragueDay(1), lt: startOfPragueDay(0) },
      },
      select: {
        total: true,
        shippingMethod: true,
        shippingCountry: true,
        paymentMethod: true,
        items: { select: { qty: true, isGift: true, product: { select: { purchasePrice: true, vatRate: true } } } },
      },
    }),
    prisma.order.aggregate({
      where: { status: "NEW", paymentMethod: "CARD", createdAt: { gte: startOfPragueDay(0) } },
      _sum: { total: true },
      _count: true,
    }),
  ]);

  type ProfitOrder = (typeof ordersForProfit)[number];
  const profitOf = (list: ProfitOrder[]) =>
    list.reduce((sum, order) => {
      const costOfGoods = order.items.reduce(
        (itemSum, item) =>
          itemSum +
          (item.isGift || !item.product ? 0 : purchaseCost(item.product.purchasePrice, item.product.vatRate) * item.qty),
        0,
      );
      const shippingCost = getShippingCost(order.shippingMethod, settings, order.shippingCountry, order.paymentMethod);
      return sum + Number(order.total) - costOfGoods - shippingCost;
    }, 0);
  const revenueOf = (list: { total: unknown }[]) => list.reduce((sum, o) => sum + Number(o.total), 0);

  const netProfit30d = profitOf(ordersForProfit);
  const todayRevenue = revenueOf(todayOrders);
  const todayProfit = profitOf(todayOrders as ProfitOrder[]);
  const yesterdayRevenue = revenueOf(yesterdayOrders);
  const yesterdayProfit = profitOf(yesterdayOrders as ProfitOrder[]);

  const avgOrderValue30d = revenue._count > 0 ? Number(revenue._sum.total ?? 0) / revenue._count : 0;
  const avgMargin30d = revenue._count > 0 ? netProfit30d / revenue._count : 0;

  const stats = [
    { label: "Produkty", value: products, href: "/admin/produkty" },
    { label: "Nové objednávky", value: newOrders, href: "/admin/objednavky?status=NEW" },
    { label: "Objednávky celkem", value: orders, href: "/admin/objednavky" },
    { label: "Značky", value: brands, href: "/admin/znacky" },
    { label: "Kategorie", value: categories, href: "/admin/kategorie" },
    { label: "Recenze čeká na schválení", value: pendingReviews, href: "/admin/recenze" },
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

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="rounded-sm border border-line bg-white p-4">
          <div className="text-sm text-accent-2">Dnešní obrat</div>
          <div className="text-2xl font-bold text-ink">{formatPrice(todayRevenue)}</div>
          <div className="text-xs text-accent-2">
            {todayOrders.length} objednávek (bez zrušených) · včera {formatPrice(yesterdayRevenue)} ({yesterdayOrders.length})
          </div>
          {todayUnconfirmed._count > 0 && (
            <div className="mt-1 text-xs text-accent-2">
              + {todayUnconfirmed._count} nepotvrzených platba kartou ({formatPrice(todayUnconfirmed._sum.total ?? 0)})
            </div>
          )}
        </div>

        <div className="rounded-sm border border-line bg-white p-4">
          <div className="text-sm text-accent-2">Dnešní zisk</div>
          <div className={`text-2xl font-bold ${todayProfit >= 0 ? "text-ink" : "text-red-600"}`}>
            {formatPrice(todayProfit)}
          </div>
          <div className="text-xs text-accent-2">
            Po odečtení zboží a dopravy · včera {formatPrice(yesterdayProfit)}
          </div>
        </div>

      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-sm border border-line bg-white p-4">
          <div className="text-sm text-accent-2">Výnos za posledních 30 dní</div>
          <div className="text-2xl font-bold text-ink">
            {formatPrice(revenue._sum.total ?? 0)}
          </div>
          <div className="text-xs text-accent-2">{revenue._count} zaplacených objednávek</div>
        </div>

        <div className="rounded-sm border border-line bg-white p-4">
          <div className="text-sm text-accent-2">Čistý zisk za posledních 30 dní</div>
          <div className={`text-2xl font-bold ${netProfit30d >= 0 ? "text-ink" : "text-red-600"}`}>
            {formatPrice(netProfit30d)}
          </div>
          <div className="text-xs text-accent-2">
            Po odečtení nákladů na zboží a dopravu (bez poplatků za platbu kartou)
          </div>
        </div>

        <div className="rounded-sm border border-line bg-white p-4">
          <div className="text-sm text-accent-2">Průměrná hodnota objednávky</div>
          <div className="text-2xl font-bold text-ink">{formatPrice(avgOrderValue30d)}</div>
          <div className="text-xs text-accent-2">Průměrná marže: {formatPrice(avgMargin30d)}</div>
        </div>
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
