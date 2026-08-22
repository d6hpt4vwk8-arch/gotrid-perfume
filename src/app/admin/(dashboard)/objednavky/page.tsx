import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { formatPrice } from "@/lib/format";
import { ORDER_STATUS_LABELS } from "@/lib/orders/status-labels";
import { getCustomerReputationMap } from "@/lib/customer-reputation";
import type { OrderStatus } from "@prisma/client";

const PAGE_SIZE = 30;

export default async function AdminOrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; page?: string }>;
}) {
  const { status, page: pageParam } = await searchParams;
  const page = Math.max(1, Number(pageParam) || 1);
  const where = status && status in ORDER_STATUS_LABELS ? { status: status as OrderStatus } : {};

  const [orders, total] = await Promise.all([
    prisma.order.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    prisma.order.count({ where }),
  ]);
  const reputationMap = await getCustomerReputationMap(orders.map((o) => o.email));

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

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

      <div className="flex flex-wrap gap-2 text-sm">
        <Link
          href="/admin/objednavky"
          className={`rounded-full border px-3 py-1 ${!status ? "border-ink bg-ink text-white" : "border-line"}`}
        >
          Vše
        </Link>
        {Object.entries(ORDER_STATUS_LABELS).map(([value, label]) => (
          <Link
            key={value}
            href={`/admin/objednavky?status=${value}`}
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
                <td className="px-3 py-2">{ORDER_STATUS_LABELS[o.status]}</td>
              </tr>
            ))}
            {orders.length === 0 && (
              <tr>
                <td colSpan={5} className="px-3 py-6 text-center text-accent-2">
                  Žádné objednávky.
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
              href={`/admin/objednavky?${new URLSearchParams({ ...(status ? { status } : {}), page: String(p) })}`}
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
