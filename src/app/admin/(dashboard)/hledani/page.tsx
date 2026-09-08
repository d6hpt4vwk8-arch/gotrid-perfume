import Link from "next/link";
import { prisma } from "@/lib/prisma";

const DAY_OPTIONS = [7, 30, 90] as const;
const TOP_TAKE = 50;

export default async function AdminSearchPage({
  searchParams,
}: {
  searchParams: Promise<{ days?: string }>;
}) {
  const { days: daysParam } = await searchParams;
  const days = DAY_OPTIONS.includes(Number(daysParam) as (typeof DAY_OPTIONS)[number])
    ? Number(daysParam)
    : 30;
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const where = { createdAt: { gte: since } };

  const [totalSearches, zeroResultTotal, topQueries, topZeroResultQueries] = await Promise.all([
    prisma.searchLog.count({ where }),
    prisma.searchLog.count({ where: { ...where, resultCount: 0 } }),
    prisma.searchLog.groupBy({
      by: ["query"],
      where,
      _count: { query: true },
      _min: { resultCount: true },
      _max: { resultCount: true },
      orderBy: { _count: { query: "desc" } },
      take: TOP_TAKE,
    }),
    prisma.searchLog.groupBy({
      by: ["query"],
      where: { ...where, resultCount: 0 },
      _count: { query: true },
      orderBy: { _count: { query: "desc" } },
      take: TOP_TAKE,
    }),
  ]);

  const zeroResultRate = totalSearches > 0 ? (zeroResultTotal / totalSearches) * 100 : 0;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-ink">Vyhledávání na webu</h1>
        <div className="flex gap-2 text-sm">
          {DAY_OPTIONS.map((d) => (
            <Link
              key={d}
              href={`/admin/hledani?days=${d}`}
              className={`rounded-full border px-3 py-1 ${
                d === days ? "border-ink bg-ink text-white" : "border-line"
              }`}
            >
              {d} dní
            </Link>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-sm border border-line bg-white p-4">
          <div className="text-xs font-semibold uppercase text-accent-2">Hledání celkem</div>
          <div className="mt-1 text-2xl font-bold text-ink">{totalSearches}</div>
        </div>
        <div className="rounded-sm border border-line bg-white p-4">
          <div className="text-xs font-semibold uppercase text-accent-2">Unikátních dotazů</div>
          <div className="mt-1 text-2xl font-bold text-ink">
            {/* Count of distinct queries in the "top" list only approximates this
                once it's capped by TOP_TAKE — shown as-is since that cap only
                matters for shops with far more search volume than this one has. */}
            {topQueries.length}
            {topQueries.length === TOP_TAKE ? "+" : ""}
          </div>
        </div>
        <div className="rounded-sm border border-line bg-white p-4">
          <div className="text-xs font-semibold uppercase text-accent-2">Bez výsledku</div>
          <div className={`mt-1 text-2xl font-bold ${zeroResultRate > 15 ? "text-red-600" : "text-ink"}`}>
            {zeroResultRate.toFixed(1)} %
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="rounded-sm border border-line bg-white p-4">
          <h2 className="mb-3 text-sm font-semibold text-ink">
            Hledané bez výsledku — co nám v nabídce chybí
          </h2>
          {topZeroResultQueries.length === 0 ? (
            <p className="text-sm text-accent-2">Žádné bezvýsledné hledání za toto období.</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="text-left text-xs uppercase text-accent-2">
                <tr>
                  <th className="py-1">Dotaz</th>
                  <th className="py-1 text-right">Počet hledání</th>
                </tr>
              </thead>
              <tbody>
                {topZeroResultQueries.map((row) => (
                  <tr key={row.query} className="border-t border-line">
                    <td className="py-1.5">{row.query}</td>
                    <td className="py-1.5 text-right font-medium text-red-600">
                      {row._count.query}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="rounded-sm border border-line bg-white p-4">
          <h2 className="mb-3 text-sm font-semibold text-ink">Nejčastěji hledané</h2>
          {topQueries.length === 0 ? (
            <p className="text-sm text-accent-2">Žádné hledání za toto období.</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="text-left text-xs uppercase text-accent-2">
                <tr>
                  <th className="py-1">Dotaz</th>
                  <th className="py-1 text-right">Počet hledání</th>
                  <th className="py-1 text-right">Výsledků</th>
                </tr>
              </thead>
              <tbody>
                {topQueries.map((row) => (
                  <tr key={row.query} className="border-t border-line">
                    <td className="py-1.5">{row.query}</td>
                    <td className="py-1.5 text-right font-medium">{row._count.query}</td>
                    <td className="py-1.5 text-right text-accent-2">
                      {row._min.resultCount === row._max.resultCount
                        ? row._min.resultCount
                        : `${row._min.resultCount}–${row._max.resultCount}`}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
