import Link from "next/link";
import { loadSupplierChanges } from "@/lib/admin/supplier-history";

export const dynamic = "force-dynamic";

function formatDateTime(d: Date): string {
  return d.toLocaleString("cs-CZ", { day: "numeric", month: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "Europe/Prague" });
}

function StatCard({ label, value, hint }: { label: string; value: string | number; hint?: string }) {
  return (
    <div className="rounded-sm border border-line bg-white p-4">
      <span className="block text-xs uppercase text-accent-2">{label}</span>
      <span className="block text-2xl font-bold text-ink">{value}</span>
      {hint && <span className="block text-xs text-accent-2">{hint}</span>}
    </div>
  );
}

const MAX_ROWS = 400;

// What the suppliers did to their own numbers lately: wholesale price moves
// and stock jumps, straight from SupplierStockLog. The point is to learn the
// supplier's habits (how often prices move, whether stock is topped up or only
// drains) — nobody there explains it.
export default async function SupplierChangesPage({
  searchParams,
}: {
  searchParams: Promise<{ days?: string; typ?: string; min?: string }>;
}) {
  const sp = await searchParams;
  const days = Math.min(90, Math.max(1, Number(sp.days) || 7));
  const typ = sp.typ === "sklad" || sp.typ === "cena" ? sp.typ : "vse";
  const minPct = Math.max(0, Number(sp.min?.replace(",", ".")) || 1);

  const { changes, summary } = await loadSupplierChanges(days);

  const shown = changes
    .filter((c) => {
      if (typ === "cena") return c.priceChanged && Math.abs(c.pricePct) >= minPct;
      if (typ === "sklad") return c.stockChanged;
      return (c.priceChanged && Math.abs(c.pricePct) >= minPct) || c.stockChanged;
    })
    .slice(0, MAX_ROWS);

  const sharePriceChanged = summary.trackedProducts > 0 ? Math.round((summary.priceChanged / summary.trackedProducts) * 100) : 0;

  return (
    <div className="flex flex-col gap-4">
      <div>
        <Link href="/admin/sledovani-spv" className="text-sm text-accent-2 underline hover:text-accent">
          ← Sledování dodavatelů
        </Link>
        <h1 className="mt-1 text-2xl font-bold text-ink">Změny cen a zásob u dodavatelů</h1>
        <p className="text-sm text-accent-2">
          Všechny změny, které synchronizace SP Venture a Tamda zaznamenaly: nákupní cena bez DPH a stav skladu dodavatele. Slouží k pochopení
          chování dodavatele (jak často mění ceny, jestli sklad doplňuje, nebo jen ubývá).
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label={`Produktů se změnou ceny (${days} d)`} value={summary.priceChanged} hint={`${sharePriceChanged} % ze ${summary.trackedProducts} sledovaných`} />
        <StatCard label="Změn ceny ↑ / ↓" value={`${summary.priceUp} / ${summary.priceDown}`} hint={summary.medianUpPct !== null ? `typické zdražení +${summary.medianUpPct.toFixed(1)} %` : undefined} />
        <StatCard label="Velká doplnění skladu" value={summary.bigRestocks} hint="≥ 50 ks a ≥ +50 %" />
        <StatCard label="Velké poklesy skladu" value={summary.bigDrops} hint="≥ 50 ks a ≥ −40 %" />
      </div>

      <form method="get" className="flex flex-wrap items-end gap-3 text-sm">
        <label className="flex flex-col gap-1">
          <span className="text-xs uppercase text-accent-2">Období</span>
          <select name="days" defaultValue={String(days)} className="rounded-sm border border-line px-2 py-1.5">
            {[1, 3, 7, 14, 30, 90].map((d) => (
              <option key={d} value={d}>
                {d === 1 ? "24 hodin" : `${d} dní`}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs uppercase text-accent-2">Co</span>
          <select name="typ" defaultValue={typ} className="rounded-sm border border-line px-2 py-1.5">
            <option value="vse">cena i sklad</option>
            <option value="cena">jen ceny</option>
            <option value="sklad">jen sklad</option>
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs uppercase text-accent-2">Změna ceny od (%)</span>
          <input name="min" defaultValue={String(minPct)} className="w-20 rounded-sm border border-line px-2 py-1.5" />
        </label>
        <button type="submit" className="rounded-sm bg-ink px-3 py-1.5 text-white">
          Zobrazit
        </button>
      </form>

      <div className="overflow-x-auto rounded-sm border border-line bg-white">
        <table className="w-full min-w-[760px] text-sm">
          <thead className="border-b border-line bg-white text-left text-xs uppercase text-accent-2">
            <tr>
              <th className="px-3 py-2">Kdy</th>
              <th className="px-3 py-2">Produkt</th>
              <th className="px-3 py-2">Dodavatel</th>
              <th className="px-3 py-2">Nákup bez DPH</th>
              <th className="px-3 py-2">Sklad dodavatele</th>
            </tr>
          </thead>
          <tbody>
            {shown.map((c) => (
              <tr key={`${c.productId}-${c.at.toISOString()}`} className="border-b border-line last:border-0">
                <td className="px-3 py-2 text-accent-2">{formatDateTime(c.at)}</td>
                <td className="px-3 py-2">
                  <Link href={`/admin/sledovani-spv/${c.productId}`} className="underline hover:text-accent">
                    {c.name}
                  </Link>
                  <div className="text-xs text-accent-2">{c.code}</div>
                </td>
                <td className="px-3 py-2 text-accent-2">{c.code.startsWith("SPV-") ? "SP Venture" : c.code.startsWith("TDE-") ? "Tamda" : "—"}</td>
                <td className="px-3 py-2">
                  {c.priceChanged ? (
                    <>
                      {c.prevPrice.toFixed(2)} → {c.price.toFixed(2)} Kč
                      <span className={c.pricePct > 0 ? "ml-1 text-red-600" : "ml-1 text-ok"}>
                        ({c.pricePct > 0 ? "+" : ""}
                        {c.pricePct.toFixed(1)} %)
                      </span>
                    </>
                  ) : (
                    <span className="text-accent-2">beze změny</span>
                  )}
                </td>
                <td className="px-3 py-2">
                  {c.stockChanged ? (
                    <>
                      {c.prevStock} → {c.stock} ks
                    </>
                  ) : (
                    <span className="text-accent-2">beze změny</span>
                  )}
                </td>
              </tr>
            ))}
            {shown.length === 0 && (
              <tr>
                <td colSpan={5} className="px-3 py-4 text-center text-accent-2">
                  V tomto období nic neodpovídá filtru.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {changes.length > 0 && shown.length === MAX_ROWS && <p className="text-xs text-accent-2">Zobrazeno prvních {MAX_ROWS} změn — zúžte filtr.</p>}
    </div>
  );
}
