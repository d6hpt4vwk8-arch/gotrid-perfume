import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { loadSupplierWatch, supplierCodeFilter } from "@/lib/admin/supplier-watch";

export const dynamic = "force-dynamic";

function formatDate(d: Date): string {
  return d.toLocaleString("cs-CZ", { day: "numeric", month: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "Europe/Prague" });
}

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-sm border border-line bg-white p-4">
      <span className="block text-xs uppercase text-accent-2">{label}</span>
      <span className="block text-2xl font-bold text-ink">{value}</span>
    </div>
  );
}

// What the suppliers (SP Venture, Tamda) show for the goods we actually sell,
// over time: how fast their stock drains or refills and when the wholesale
// price moved, next to our own sales. The owner uses it to decide when to buy a
// few extra units ahead of a supplier stockout (the price tends to jump when
// the cheap pool runs dry — see the Yara gift set, 392 → 625 Kč, October 2026).
// History comes from SupplierStockLog, written by the stock syncs; it only
// starts when a sync first ran with logging, so older comparisons show "—".
export default async function AdminSupplierWatchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const query = (q ?? "").trim();

  const searchMatches = query
    ? await prisma.product.findMany({
        where: {
          AND: [
            supplierCodeFilter,
            { OR: [{ name: { contains: query, mode: "insensitive" } }, { code: { contains: query, mode: "insensitive" } }] },
          ],
        },
        select: { id: true },
        take: 40,
      })
    : [];

  const [{ rows, firstLogAt }, lastSpvSync, lastTamdaSync] = await Promise.all([
    loadSupplierWatch(searchMatches.map((p) => p.id)),
    prisma.adminActivityLog.findFirst({ where: { action: "product.spventure_sync" }, orderBy: { createdAt: "desc" }, select: { createdAt: true } }),
    prisma.adminActivityLog.findFirst({ where: { action: "product.tamda_sync" }, orderBy: { createdAt: "desc" }, select: { createdAt: true } }),
  ]);

  const fallingCount = rows.filter((r) => r.falling).length;
  const lowCount = rows.filter((r) => r.low).length;

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-bold text-ink">Sledování dodavatelů</h1>
        <p className="text-sm text-accent-2">
          Co ukazuje dodavatel (SP Venture, Tamda) u zboží, které prodáváme (posledních 60 dní) nebo máme na vlastním skladě: stav
          jeho skladu, vývoj za 24 h a 7 dní, změny nákupní ceny — vedle našich prodejů. Hodí se na rozhodnutí, kdy dokoupit pár
          kusů předem.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Sledovaných produktů" value={rows.length} />
        <StatCard label="Klesá ≥ 20 % za 7 dní" value={fallingCount} />
        <StatCard label="Dochází (≤ 10 ks, prodává se)" value={lowCount} />
        <StatCard
          label="Poslední změna sync SPV / Tamda"
          value={`${lastSpvSync ? formatDate(lastSpvSync.createdAt) : "—"} / ${lastTamdaSync ? formatDate(lastTamdaSync.createdAt) : "—"}`}
        />
      </div>
      <p className="text-xs text-accent-2">
        Historie se ukládá od {firstLogAt ? formatDate(firstLogAt) : "prvního běhu synchronizace"} — srovnání za 24 h / 7 dní se plní
        postupně. Změna se zaznamená při každém běhu synchronizace (SPV: každou hodinu a ráno v 6:00, Tamda: v noci a odpoledne).
      </p>

      <form method="get" className="flex gap-2">
        <input
          name="q"
          defaultValue={query}
          placeholder="Najít jiný produkt (název nebo kód)…"
          className="w-full max-w-sm rounded-sm border border-line px-3 py-1.5 text-sm"
        />
        <button type="submit" className="rounded-sm bg-ink px-3 py-1.5 text-sm text-white">
          Hledat
        </button>
      </form>

      <div className="overflow-x-auto rounded-sm border border-line bg-white">
        <table className="w-full min-w-[900px] text-sm">
          <thead className="border-b border-line bg-white text-left text-xs uppercase text-accent-2">
            <tr>
              <th className="px-3 py-2">Produkt</th>
              <th className="px-3 py-2">Prodali jsme 30 d / 60 d</th>
              <th className="px-3 py-2">Sklad dodavatele nyní</th>
              <th className="px-3 py-2">před 24 h</th>
              <th className="px-3 py-2">před 7 dny</th>
              <th className="px-3 py-2">Tempo / vystačí</th>
              <th className="px-3 py-2">Nákup bez DPH</th>
              <th className="px-3 py-2">Náš sklad</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ product: p, sold30, sold60, supplierNow, s1, s7, delta7, perDay, daysLeft, cost, costChange, costUp, falling, low }) => (
              <tr key={p.id} className="border-b border-line last:border-0">
                <td className="px-3 py-2">
                  <Link href={`/admin/produkty/${p.id}`} className="underline hover:text-accent">
                    {p.name}
                  </Link>
                  <div className="text-xs text-accent-2">
                    {p.code}
                    {!p.visible && " · skryto"}
                    {p.slowerDelivery && " · jen z druhého skladu"}
                  </div>
                  {(falling || low || costUp) && (
                    <div className="mt-1 flex flex-wrap gap-1 text-xs">
                      {falling && <span className="rounded-sm bg-amber-100 px-1.5 py-0.5 text-amber-800">sklad klesá</span>}
                      {low && <span className="rounded-sm bg-red-100 px-1.5 py-0.5 text-red-700">dochází</span>}
                      {costUp && <span className="rounded-sm bg-red-100 px-1.5 py-0.5 text-red-700">cena ↑</span>}
                    </div>
                  )}
                </td>
                <td className="px-3 py-2">
                  {sold30} / {sold60}
                </td>
                <td className="px-3 py-2 font-medium">{supplierNow} ks</td>
                <td className="px-3 py-2 text-accent-2">{s1 !== null ? `${s1} ks` : "—"}</td>
                <td className="px-3 py-2 text-accent-2">
                  {s7 !== null ? `${s7} ks` : "—"}
                  {delta7 !== null && delta7 !== 0 && (
                    <span className={delta7 < 0 ? "ml-1 text-red-600" : "ml-1 text-ok"}>
                      ({delta7 > 0 ? "+" : ""}
                      {delta7})
                    </span>
                  )}
                </td>
                <td className="px-3 py-2 text-accent-2">
                  {perDay !== null ? `−${perDay.toFixed(1)} ks/den` : "—"}
                  {daysLeft !== null && <div className="text-xs">vystačí ~{daysLeft} dní</div>}
                </td>
                <td className="px-3 py-2">
                  {Math.round(cost)} Kč
                  {costChange !== null && Math.abs(costChange) >= 1 && (
                    <span className={costChange > 0 ? "ml-1 text-red-600" : "ml-1 text-ok"}>
                      ({costChange > 0 ? "+" : ""}
                      {Math.round(costChange)})
                    </span>
                  )}
                  <div className="text-xs text-accent-2">prodej {Math.round(p.price)} Kč</div>
                </td>
                <td className="px-3 py-2">{p.ownStock > 0 ? `${p.ownStock} ks` : "—"}</td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={8} className="px-3 py-4 text-center text-accent-2">
                  Zatím nic ke sledování — žádný prodej zboží dodavatelů za posledních 60 dní.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
