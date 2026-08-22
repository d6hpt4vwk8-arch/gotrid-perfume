import Link from "next/link";
import { prisma } from "@/lib/prisma";

const PAGE_SIZE = 50;

const ACTION_LABELS: Record<string, string> = {
  "product.price_change": "Změna ceny",
  "product.stock_change": "Změna skladu",
  "product.delete": "Smazání produktu",
  "order.status_change": "Změna stavu objednávky",
  "order.tracking_change": "Sledovací číslo",
  "coupon.create": "Vytvoření slevového kódu",
  "coupon.update": "Úprava slevového kódu",
  "coupon.delete": "Smazání slevového kódu",
  "order.packeta_label_created": "Vytvoření štítku Zásilkovna",
  "marketing.second_order_email": "E-mail druhá objednávka",
  "newsletter.send": "Odeslání newsletteru",
};

export default async function AdminActivityLogPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const { page: pageParam } = await searchParams;
  const page = Math.max(1, Number(pageParam) || 1);

  const [entries, total] = await Promise.all([
    prisma.adminActivityLog.findMany({
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    prisma.adminActivityLog.count(),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-bold text-ink">Log činností ({total})</h1>

      <div className="overflow-x-auto rounded-sm border border-line bg-white">
        <table className="w-full min-w-[600px] text-sm">
          <thead className="border-b border-line bg-white text-left text-xs uppercase text-accent-2">
            <tr>
              <th className="px-3 py-2">Datum</th>
              <th className="px-3 py-2">Akce</th>
              <th className="px-3 py-2">Detail</th>
            </tr>
          </thead>
          <tbody>
            {entries.map((entry) => (
              <tr key={entry.id} className="border-b border-line last:border-0">
                <td className="whitespace-nowrap px-3 py-2 text-accent-2">
                  {new Date(entry.createdAt).toLocaleString("cs-CZ")}
                </td>
                <td className="px-3 py-2 font-medium">
                  {ACTION_LABELS[entry.action] ?? entry.action}
                </td>
                <td className="px-3 py-2 text-accent-2">{entry.detail}</td>
              </tr>
            ))}
            {entries.length === 0 && (
              <tr>
                <td colSpan={3} className="px-3 py-6 text-center text-accent-2">
                  Zatím žádné záznamy.
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
              href={`/admin/log?page=${p}`}
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
