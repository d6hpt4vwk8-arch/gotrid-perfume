import Link from "next/link";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { formatPrice } from "@/lib/format";
import { ORDER_STATUS_LABELS } from "@/lib/orders/status-labels";
import { getCustomerReputationMap } from "@/lib/customer-reputation";
import { getReturnStatsByMethod } from "@/lib/orders/return-stats.server";
import { SHIPPING_LABELS } from "@/lib/shipping";
import type { OrderStatus } from "@prisma/client";

const PAGE_SIZE = 30;

export default async function AdminOrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; page?: string; q?: string }>;
}) {
  const { status, page: pageParam, q } = await searchParams;
  const page = Math.max(1, Number(pageParam) || 1);
  const query = q?.trim() ?? "";

  const statusFilter: Prisma.OrderWhereInput =
    status && status in ORDER_STATUS_LABELS ? { status: status as OrderStatus } : {};
  // Číslo/jméno/telefon/e-mail live directly on Order; a product name needs
  // reaching through items — "some" so any one matching line item counts,
  // not every item in a multi-item order.
  const searchFilter: Prisma.OrderWhereInput = query
    ? {
        OR: [
          { number: { contains: query, mode: "insensitive" } },
          { firstName: { contains: query, mode: "insensitive" } },
          { lastName: { contains: query, mode: "insensitive" } },
          { phone: { contains: query, mode: "insensitive" } },
          { email: { contains: query, mode: "insensitive" } },
          { items: { some: { name: { contains: query, mode: "insensitive" } } } },
        ],
      }
    : {};
  const where: Prisma.OrderWhereInput = { AND: [statusFilter, searchFilter] };

  const [orders, total, returnStats] = await Promise.all([
    prisma.order.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    prisma.order.count({ where }),
    getReturnStatsByMethod(),
  ]);
  const reputationMap = await getCustomerReputationMap(orders.map((o) => o.email));
  const totalDelivered = returnStats.reduce((sum, r) => sum + r.delivered, 0);
  const totalReturned = returnStats.reduce((sum, r) => sum + r.returned, 0);
  const overallRate =
    totalDelivered + totalReturned > 0 ? (totalReturned / (totalDelivered + totalReturned)) * 100 : 0;

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  // Carries status (but never page — a new search/status always starts back
  // at page 1) forward through the pagination links below.
  const baseParams = { ...(status ? { status } : {}), ...(query ? { q: query } : {}) };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-ink">Objednávky ({total})</h1>
        <a
          href={`/api/admin/orders/export${status ? `?status=${status}` : ""}`}
          className="rounded-sm border border-line px-4 py-2 text-sm font-medium hover:border-accent-2"
        >
          Export do XLSX
        </a>
      </div>

      <form method="get" className="flex gap-2">
        {status && <input type="hidden" name="status" value={status} />}
        <input
          type="search"
          name="q"
          defaultValue={query}
          placeholder="Číslo objednávky, jméno, telefon, e-mail nebo název produktu…"
          className="w-full max-w-md rounded-sm border border-line px-3 py-2 text-sm"
        />
        <button
          type="submit"
          className="rounded-sm bg-ink px-4 py-2 text-sm font-medium text-white hover:bg-accent"
        >
          Hledat
        </button>
        {query && (
          <Link
            href={status ? `/admin/objednavky?status=${status}` : "/admin/objednavky"}
            className="rounded-sm border border-line px-4 py-2 text-sm hover:border-accent-2"
          >
            Zrušit
          </Link>
        )}
      </form>

      {totalDelivered + totalReturned > 0 && (
        <div className="rounded-sm border border-line bg-white p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase text-accent-2">
              Nevyzvednuté zásilky (vráceno dopravcem)
            </span>
            <span
              className={`text-sm font-bold ${overallRate > 10 ? "text-red-600" : "text-ink"}`}
            >
              {overallRate.toFixed(1)} % celkem ({totalReturned} z {totalDelivered + totalReturned})
            </span>
          </div>
          <table className="mt-3 w-full text-sm">
            <thead className="text-left text-xs uppercase text-accent-2">
              <tr>
                <th className="py-1">Doprava</th>
                <th className="py-1 text-right">Doručeno</th>
                <th className="py-1 text-right">Vráceno</th>
                <th className="py-1 text-right">Podíl vrácených</th>
              </tr>
            </thead>
            <tbody>
              {returnStats.map((row) => (
                <tr key={row.method} className="border-t border-line">
                  <td className="py-1.5">{SHIPPING_LABELS[row.method]}</td>
                  <td className="py-1.5 text-right">{row.delivered}</td>
                  <td className="py-1.5 text-right">{row.returned}</td>
                  <td
                    className={`py-1.5 text-right font-medium ${
                      row.ratePercent > 10 ? "text-red-600" : "text-ink"
                    }`}
                  >
                    {row.ratePercent.toFixed(1)} %
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="flex flex-wrap gap-2 text-sm">
        <Link
          href={query ? `/admin/objednavky?q=${encodeURIComponent(query)}` : "/admin/objednavky"}
          className={`rounded-full border px-3 py-1 ${!status ? "border-ink bg-ink text-white" : "border-line"}`}
        >
          Vše
        </Link>
        {Object.entries(ORDER_STATUS_LABELS).map(([value, label]) => (
          <Link
            key={value}
            href={`/admin/objednavky?${new URLSearchParams({ status: value, ...(query ? { q: query } : {}) })}`}
            className={`rounded-full border px-3 py-1 ${status === value ? "border-ink bg-ink text-white" : "border-line"}`}
          >
            {label}
          </Link>
        ))}
      </div>

      <div className="overflow-x-auto rounded-sm border border-line bg-white">
        <table className="w-full min-w-[600px] text-sm">
          <thead className="border-b border-line bg-white text-left text-xs uppercase text-accent-2">
            <tr>
              <th className="px-3 py-2">Číslo</th>
              <th className="px-3 py-2">Datum</th>
              <th className="px-3 py-2">Zákazník</th>
              <th className="px-3 py-2">Celkem</th>
              <th className="px-3 py-2">Stav</th>
            </tr>
          </thead>
          <tbody>
            {orders.map((o) => (
              <tr key={o.id} className="border-b border-line last:border-0 hover:bg-white">
                <td className="px-3 py-2">
                  <Link href={`/admin/objednavky/${o.id}`} className="font-medium hover:underline">
                    {o.number}
                  </Link>
                </td>
                <td className="px-3 py-2 text-accent-2">
                  {new Date(o.createdAt).toLocaleString("cs-CZ")}
                </td>
                <td className="px-3 py-2">
                  {o.firstName} {o.lastName}
                  {reputationMap.get(o.email)?.risk && (
                    <span title="Má zrušenou/vrácenou objednávku" className="ml-1.5">
                      😠
                    </span>
                  )}
                  {reputationMap.get(o.email)?.repeat && (
                    <span title="Stálý zákazník (2+ objednávky)" className="ml-1.5">
                      😊
                    </span>
                  )}
                </td>
                <td className="px-3 py-2">{formatPrice(o.total)}</td>
                <td className="px-3 py-2">
                  {ORDER_STATUS_LABELS[o.status]}
                  {o.paymentMethod === "CARD" && o.status === "NEW" && (
                    <span
                      title="Platba kartou zatím nepotvrzena — nevyřizovat, dokud se nezmění na Zaplaceno"
                      className="ml-1.5 rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700"
                    >
                      ⚠ čeká na platbu
                    </span>
                  )}
                </td>
              </tr>
            ))}
            {orders.length === 0 && (
              <tr>
                <td colSpan={5} className="px-3 py-6 text-center text-accent-2">
                  {query ? `Žádné objednávky neodpovídají „${query}“.` : "Žádné objednávky."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="flex justify-center gap-2">
          {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
            <Link
              key={p}
              href={`/admin/objednavky?${new URLSearchParams({ ...baseParams, page: String(p) })}`}
              className={`rounded px-3 py-1 text-sm ${
                p === page ? "bg-ink text-white" : "border border-line"
              }`}
            >
              {p}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
