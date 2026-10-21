import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { formatPrice } from "@/lib/format";
import { getSettings } from "@/lib/settings.server";
import { getShippingCost } from "@/lib/shipping";
import { purchaseCost } from "@/lib/cost-of-goods";
import { NO_SOURCE, trafficChannel } from "@/lib/admin/traffic-channel";

// Same inclusion rule as the dashboard's daily figures: paid/processed orders plus
// COD and bank-transfer orders from the moment they are placed (they sit in NEW
// until shipped/paid). Unconfirmed card orders (may be abandoned) stay out.
const REVENUE_STATUSES = ["PAID", "PROCESSING", "SHIPPED", "DELIVERED"] as const;

const PERIODS = [
  { value: "7", label: "7 dní", days: 7 },
  { value: "30", label: "30 dní", days: 30 },
  { value: "90", label: "90 dní", days: 90 },
] as const;

export default async function OrderSourcesPage({
  searchParams,
}: {
  searchParams: Promise<{ days?: string }>;
}) {
  const { days: daysParam } = await searchParams;
  const period = PERIODS.find((p) => p.value === daysParam) ?? PERIODS[1];
  const since = new Date(Date.now() - period.days * 24 * 60 * 60 * 1000);

  const [settings, orders] = await Promise.all([
    getSettings(),
    prisma.order.findMany({
      where: {
        createdAt: { gte: since },
        OR: [
          { status: { in: [...REVENUE_STATUSES] } },
          { status: "NEW", paymentMethod: { not: "CARD" } },
        ],
      },
      select: {
        total: true,
        trafficSource: true,
        shippingMethod: true,
        shippingCountry: true,
        paymentMethod: true,
        items: { select: { qty: true, isGift: true, product: { select: { purchasePrice: true, vatRate: true } } } },
      },
    }),
  ]);

  const channels = new Map<string, { orders: number; revenue: number; profit: number }>();
  for (const order of orders) {
    const costOfGoods = order.items.reduce(
      (sum, item) =>
        sum + (item.isGift || !item.product ? 0 : purchaseCost(item.product.purchasePrice, item.product.vatRate) * item.qty),
      0,
    );
    const shippingCost = getShippingCost(order.shippingMethod, settings, order.shippingCountry, order.paymentMethod);
    const revenue = Number(order.total);
    const key = trafficChannel(order.trafficSource);
    const row = channels.get(key) ?? { orders: 0, revenue: 0, profit: 0 };
    row.orders += 1;
    row.revenue += revenue;
    row.profit += revenue - costOfGoods - shippingCost;
    channels.set(key, row);
  }

  const rows = [...channels.entries()].sort((a, b) => b[1].revenue - a[1].revenue);
  const totals = rows.reduce(
    (t, [, r]) => ({ orders: t.orders + r.orders, revenue: t.revenue + r.revenue, profit: t.profit + r.profit }),
    { orders: 0, revenue: 0, profit: 0 },
  );
  const hasNoSource = channels.has(NO_SOURCE);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-ink">Zdroje objednávek</h1>
        <div className="flex gap-2 text-sm">
          {PERIODS.map((p) => (
            <Link
              key={p.value}
              href={`/admin/zdroje-objednavek?days=${p.value}`}
              className={`rounded-full border px-3 py-1 ${p.value === period.value ? "border-ink bg-ink text-white" : "border-line"}`}
            >
              {p.label}
            </Link>
          ))}
        </div>
      </div>

      <div className="overflow-x-auto rounded-sm border border-line bg-white">
        <table className="w-full min-w-[640px] text-sm">
          <thead className="border-b border-line text-left text-xs uppercase text-accent-2">
            <tr>
              <th className="px-3 py-2">Zdroj</th>
              <th className="px-3 py-2 text-right">Objednávek</th>
              <th className="px-3 py-2 text-right">Obrat</th>
              <th className="px-3 py-2 text-right">Podíl obratu</th>
              <th className="px-3 py-2 text-right">Prům. košík</th>
              <th className="px-3 py-2 text-right">Zisk</th>
              <th className="px-3 py-2 text-right">Zisk / obj.</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(([channel, r]) => (
              <tr key={channel} className="border-b border-line last:border-0">
                <td className="px-3 py-2 font-medium">{channel}</td>
                <td className="px-3 py-2 text-right">{r.orders}</td>
                <td className="px-3 py-2 text-right">{formatPrice(r.revenue)}</td>
                <td className="px-3 py-2 text-right text-accent-2">
                  {totals.revenue > 0 ? `${Math.round((r.revenue / totals.revenue) * 100)} %` : "–"}
                </td>
                <td className="px-3 py-2 text-right">{formatPrice(r.revenue / r.orders)}</td>
                <td className={`px-3 py-2 text-right ${r.profit < 0 ? "text-red-600" : ""}`}>{formatPrice(r.profit)}</td>
                <td className={`px-3 py-2 text-right ${r.profit < 0 ? "text-red-600" : ""}`}>
                  {formatPrice(r.profit / r.orders)}
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={7} className="px-3 py-6 text-center text-accent-2">
                  V tomto období nejsou žádné objednávky.
                </td>
              </tr>
            )}
          </tbody>
          {rows.length > 0 && (
            <tfoot className="border-t border-line bg-white font-semibold">
              <tr>
                <td className="px-3 py-2">Celkem</td>
                <td className="px-3 py-2 text-right">{totals.orders}</td>
                <td className="px-3 py-2 text-right">{formatPrice(totals.revenue)}</td>
                <td className="px-3 py-2 text-right text-accent-2">100 %</td>
                <td className="px-3 py-2 text-right">{formatPrice(totals.orders ? totals.revenue / totals.orders : 0)}</td>
                <td className="px-3 py-2 text-right">{formatPrice(totals.profit)}</td>
                <td className="px-3 py-2 text-right">{formatPrice(totals.orders ? totals.profit / totals.orders : 0)}</td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      <p className="text-xs text-accent-2">
        Bez zrušených a vrácených objednávek; nepotvrzené platby kartou se nepočítají. Zisk = obrat − nákup zboží
        (s DPH) − doprava, bez poplatků za kartu a bez nákladů na reklamu. Všechny kategorie Heureky jsou sloučené do
        jednoho řádku.
        {hasNoSource && " „Bez zdroje“ jsou hlavně objednávky z doby před zavedením měření zdroje (22. 9. 2026)."}
      </p>
    </div>
  );
}
