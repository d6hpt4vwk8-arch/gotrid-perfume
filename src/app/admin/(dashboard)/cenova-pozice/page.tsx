import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { formatPrice } from "@/lib/format";
import { PriceCompetitionUploadForm } from "@/components/admin/price-competition-upload-form";

const PAGE_SIZE = 50;
// "Nejlevnější" needs a little slack above 1.00 — a product that's tied for
// cheapest across several observed impressions can still average out to
// 1.1–1.3 rather than a clean 1.00.
const CHEAPEST_MAX = 1.5;
const LOSING_MIN = 3;

export default async function AdminPriceCompetitionPage({
  searchParams,
}: {
  searchParams: Promise<{ importId?: string; page?: string; q?: string }>;
}) {
  const { importId: importIdParam, page: pageParam, q: qParam } = await searchParams;
  const query = (qParam ?? "").trim();
  const page = Math.max(1, Number(pageParam) || 1);

  const imports = await prisma.priceCompetitionImport.findMany({
    orderBy: { createdAt: "desc" },
    take: 20,
  });

  if (imports.length === 0) {
    return (
      <div className="flex flex-col gap-4">
        <h1 className="text-2xl font-bold text-ink">Cenová pozice</h1>
        <p className="text-sm text-accent-2">
          Zatím žádný report. Stáhněte „Statistiky položek (podrobný)“ v Centrum prodejce
          (Statistiky → Podrobné statistiky) a nahrajte CSV zde.
        </p>
        <PriceCompetitionUploadForm />
      </div>
    );
  }

  const selectedImport = imports.find((i) => i.id === importIdParam) ?? imports[0]!;
  const where = {
    importId: selectedImport.id,
    impressionsByPrice: { gt: 0 },
    ...(query
      ? {
          OR: [
            { offerName: { contains: query, mode: "insensitive" as const } },
            { productCode: { contains: query, mode: "insensitive" as const } },
          ],
        }
      : {}),
  };

  const [total, cheapestCount, losingCount, rows] = await Promise.all([
    prisma.priceCompetitionRow.count({
      where: { importId: selectedImport.id, impressionsByPrice: { gt: 0 } },
    }),
    prisma.priceCompetitionRow.count({
      where: {
        importId: selectedImport.id,
        impressionsByPrice: { gt: 0 },
        avgPositionByPrice: { lte: CHEAPEST_MAX },
      },
    }),
    prisma.priceCompetitionRow.count({
      where: {
        importId: selectedImport.id,
        impressionsByPrice: { gt: 0 },
        avgPositionByPrice: { gt: LOSING_MIN },
      },
    }),
    prisma.priceCompetitionRow.findMany({
      where,
      orderBy: { avgPositionByPrice: "asc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
  ]);

  const matchedCount = query
    ? await prisma.priceCompetitionRow.count({ where })
    : total;
  const totalPages = Math.max(1, Math.ceil(matchedCount / PAGE_SIZE));

  const products = await prisma.product.findMany({
    where: { code: { in: rows.map((r) => r.productCode) } },
    select: { id: true, code: true, price: true, stock: true, visible: true },
  });
  const productByCode = new Map(products.map((p) => [p.code, p]));

  const cheapestPct = total > 0 ? (cheapestCount / total) * 100 : 0;
  const losingPct = total > 0 ? (losingCount / total) * 100 : 0;

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-bold text-ink">Cenová pozice</h1>

      <div className="flex flex-wrap gap-2 text-sm">
        {imports.map((imp) => (
          <Link
            key={imp.id}
            href={`/admin/cenova-pozice?importId=${imp.id}`}
            className={`rounded-full border px-3 py-1 ${
              imp.id === selectedImport.id ? "border-ink bg-ink text-white" : "border-line"
            }`}
          >
            {imp.periodLabel || new Date(imp.createdAt).toLocaleDateString("cs-CZ")} ({imp.rowCount})
          </Link>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-sm border border-line bg-white p-4">
          <div className="text-xs font-semibold uppercase text-accent-2">
            Sledovaných pozic (zobrazeno „dle ceny“)
          </div>
          <div className="mt-1 text-2xl font-bold text-ink">{total}</div>
        </div>
        <div className="rounded-sm border border-line bg-white p-4">
          <div className="text-xs font-semibold uppercase text-accent-2">
            Nejlevnější nebo skoro (pozice ≤ {CHEAPEST_MAX})
          </div>
          <div className="mt-1 text-2xl font-bold text-ok">{cheapestPct.toFixed(1)} %</div>
          <div className="text-xs text-accent-2">{cheapestCount} položek — prostor pro vyšší marži</div>
        </div>
        <div className="rounded-sm border border-line bg-white p-4">
          <div className="text-xs font-semibold uppercase text-accent-2">
            Prohráváme na ceně (pozice &gt; {LOSING_MIN})
          </div>
          <div className="mt-1 text-2xl font-bold text-red-600">{losingPct.toFixed(1)} %</div>
          <div className="text-xs text-accent-2">{losingCount} položek</div>
        </div>
      </div>

      <PriceCompetitionUploadForm />

      <form method="get" className="flex gap-2">
        <input type="hidden" name="importId" value={selectedImport.id} />
        <input
          type="text"
          name="q"
          defaultValue={query}
          placeholder="Hledat podle názvu nebo kódu…"
          className="w-full max-w-sm rounded-sm border border-line px-3 py-2 text-sm"
        />
        <button type="submit" className="rounded-sm border border-line px-4 py-2 text-sm">
          Hledat
        </button>
      </form>

      <div className="overflow-x-auto rounded-sm border border-line bg-white">
        <table className="w-full min-w-[720px] text-sm">
          <thead className="border-b border-line bg-white text-left text-xs uppercase text-accent-2">
            <tr>
              <th className="px-3 py-2">Nabídka</th>
              <th className="px-3 py-2">Kód</th>
              <th className="px-3 py-2 text-right">Naše cena</th>
              <th className="px-3 py-2 text-right">Pozice (dle ceny)</th>
              <th className="px-3 py-2 text-right">Zobrazení</th>
              <th className="px-3 py-2">Signál</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const product = productByCode.get(row.productCode);
              const pos = row.avgPositionByPrice ? Number(row.avgPositionByPrice) : null;
              const isCheapest = pos !== null && pos <= CHEAPEST_MAX;
              const isLosing = pos !== null && pos > LOSING_MIN;
              return (
                <tr key={row.id} className="border-b border-line last:border-0">
                  <td className="px-3 py-2">
                    {product ? (
                      <Link href={`/admin/produkty/${product.id}`} className="hover:underline">
                        {row.offerName}
                      </Link>
                    ) : (
                      <span title="Produkt už v katalogu nenajdeme (smazán/změněn kód).">
                        {row.offerName}
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-accent-2">{row.productCode}</td>
                  <td className="px-3 py-2 text-right">
                    {product ? formatPrice(product.price) : "—"}
                  </td>
                  <td className="px-3 py-2 text-right font-medium">{pos?.toFixed(2) ?? "—"}</td>
                  <td className="px-3 py-2 text-right text-accent-2">{row.impressionsByPrice}</td>
                  <td className="px-3 py-2">
                    {isCheapest && (
                      <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
                        Nejlevnější — zvažte navýšení
                      </span>
                    )}
                    {isLosing && (
                      <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">
                        Prohráváme na ceně
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
            {rows.length === 0 && (
              <tr>
                <td colSpan={6} className="px-3 py-6 text-center text-accent-2">
                  Žádné položky neodpovídají hledání.
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
              href={`/admin/cenova-pozice?${new URLSearchParams({
                importId: selectedImport.id,
                ...(query ? { q: query } : {}),
                page: String(p),
              })}`}
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
