import Link from "next/link";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { formatPrice } from "@/lib/format";
import { ORDER_STATUS_LABELS } from "@/lib/orders/status-labels";

const PAGE_SIZE = 30;

export default async function AdminInvoicesPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; view?: string }>;
}) {
  const { page: pageParam, view } = await searchParams;
  const page = Math.max(1, Number(pageParam) || 1);
  const onlyCreditNotes = view === "dobropisy";

  // Same eligibility rule as canDownloadInvoice — a NEW or CANCELLED order
  // never became a real sale, so it never gets a faktura here either.
  const where: Prisma.OrderWhereInput = onlyCreditNotes
    ? { status: "REFUNDED" }
    : { status: { notIn: ["NEW", "CANCELLED"] } };

  const [orders, total] = await Promise.all([
    prisma.order.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    prisma.order.count({ where }),
  ]);
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-bold text-ink">Faktury ({total})</h1>

      <div className="flex gap-2 text-sm">
        <Link
          href="/admin/faktury"
          className={`rounded-full border px-3 py-1 ${!onlyCreditNotes ? "border-ink bg-ink text-white" : "border-line"}`}
        >
          Vše
        </Link>
        <Link
          href="/admin/faktury?view=dobropisy"
          className={`rounded-full border px-3 py-1 ${onlyCreditNotes ? "border-ink bg-ink text-white" : "border-line"}`}
        >
          Dobropisy
        </Link>
      </div>

      <div className="overflow-x-auto rounded-sm border border-line bg-white">
        <table className="w-full min-w-[700px] text-sm">
          <thead className="border-b border-line bg-white text-left text-xs uppercase text-accent-2">
            <tr>
              <th className="px-3 py-2">Číslo</th>
              <th className="px-3 py-2">Datum</th>
              <th className="px-3 py-2">Zákazník</th>
              <th className="px-3 py-2">Celkem</th>
              <th className="px-3 py-2">Stav</th>
              <th className="px-3 py-2">Dokumenty</th>
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
                  {new Date(o.createdAt).toLocaleDateString("cs-CZ")}
                </td>
                <td className="px-3 py-2">
                  {o.firstName} {o.lastName}
                </td>
                <td className="px-3 py-2">{formatPrice(o.total)}</td>
                <td className="px-3 py-2">{ORDER_STATUS_LABELS[o.status]}</td>
                <td className="px-3 py-2">
                  <div className="flex flex-wrap gap-3">
                    <a
                      href={`/api/orders/${o.number}/faktura`}
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs font-medium underline"
                    >
                      Faktura
                    </a>
                    {o.status === "REFUNDED" && (
                      <a
                        href={`/api/admin/orders/${o.id}/dobropis`}
                        target="_blank"
                        rel="noreferrer"
                        className="text-xs font-medium text-red-700 underline"
                      >
                        Dobropis (−{formatPrice(o.total)})
                      </a>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {orders.length === 0 && (
              <tr>
                <td colSpan={6} className="px-3 py-6 text-center text-accent-2">
                  {onlyCreditNotes ? "Žádné dobropisy." : "Žádné faktury."}
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
              href={`/admin/faktury?${new URLSearchParams({ ...(onlyCreditNotes ? { view: "dobropisy" } : {}), page: String(p) })}`}
              className={`rounded px-3 py-1 text-sm ${p === page ? "bg-ink text-white" : "border border-line"}`}
            >
              {p}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
