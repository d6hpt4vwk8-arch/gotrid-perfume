import Link from "next/link";
import { notFound } from "next/navigation";
import { loadProductHistory } from "@/lib/admin/supplier-history";

export const dynamic = "force-dynamic";

function formatDateTime(d: Date): string {
  return d.toLocaleString("cs-CZ", { day: "numeric", month: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "Europe/Prague" });
}

function formatDay(ms: number): string {
  return new Date(ms).toLocaleDateString("cs-CZ", { day: "numeric", month: "numeric", timeZone: "Europe/Prague" });
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

const W = 760;
const H = 150;
const PAD_L = 52;
const PAD_R = 10;
const PAD_T = 10;
const PAD_B = 22;

// A step chart: the supplier's number holds until the next recorded change.
function StepChart({ points, now, title, format }: { points: { at: number; v: number }[]; now: number; title: string; format: (v: number) => string }) {
  if (points.length === 0) return null;
  const t0 = points[0].at;
  const t1 = Math.max(now, points[points.length - 1].at, t0 + 1);
  const values = points.map((p) => p.v);
  let min = Math.min(...values);
  let max = Math.max(...values);
  if (min === max) {
    min = min * 0.95;
    max = max * 1.05 + 1;
  }
  const x = (t: number) => PAD_L + ((t - t0) / (t1 - t0)) * (W - PAD_L - PAD_R);
  const y = (v: number) => PAD_T + (1 - (v - min) / (max - min)) * (H - PAD_T - PAD_B);

  let path = `M ${x(points[0].at).toFixed(1)} ${y(points[0].v).toFixed(1)}`;
  for (let i = 1; i < points.length; i++) {
    path += ` H ${x(points[i].at).toFixed(1)} V ${y(points[i].v).toFixed(1)}`;
  }
  path += ` H ${x(t1).toFixed(1)}`;

  return (
    <div className="rounded-sm border border-line bg-white p-3">
      <div className="mb-1 text-xs uppercase text-accent-2">{title}</div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={title}>
        <line x1={PAD_L} y1={PAD_T} x2={PAD_L} y2={H - PAD_B} className="stroke-line" strokeWidth="1" />
        <line x1={PAD_L} y1={H - PAD_B} x2={W - PAD_R} y2={H - PAD_B} className="stroke-line" strokeWidth="1" />
        <text x={PAD_L - 6} y={PAD_T + 4} textAnchor="end" className="fill-accent-2" fontSize="11">
          {format(max)}
        </text>
        <text x={PAD_L - 6} y={H - PAD_B} textAnchor="end" className="fill-accent-2" fontSize="11">
          {format(min)}
        </text>
        <text x={PAD_L} y={H - 6} textAnchor="start" className="fill-accent-2" fontSize="11">
          {formatDay(t0)}
        </text>
        <text x={W - PAD_R} y={H - 6} textAnchor="end" className="fill-accent-2" fontSize="11">
          {formatDay(t1)}
        </text>
        <path d={path} fill="none" className="stroke-ink" strokeWidth="2" />
        {points.map((p, i) => (
          <circle key={i} cx={x(p.at)} cy={y(p.v)} r="2.5" className="fill-ink" />
        ))}
      </svg>
    </div>
  );
}

// What the supplier showed for one product over time (stock and wholesale
// price), from SupplierStockLog — written by the SPV/Tamda syncs whenever
// either number moves. Used to read the supplier's behaviour before buying.
export default async function SupplierProductHistoryPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { product, points } = await loadProductHistory(id);
  if (!product) notFound();

  const now = Date.now();
  const stocks = points.map((p) => p.stock);
  const prices = points.map((p) => p.price);
  const last = points.length > 0 ? points[points.length - 1] : null;
  const first = points.length > 0 ? points[0] : null;
  const priceChanges = points.filter((p, i) => i > 0 && Math.abs(p.price - points[i - 1].price) > 0.004).length;
  const rows = [...points].reverse().slice(0, 250);

  return (
    <div className="flex flex-col gap-4">
      <div>
        <Link href="/admin/sledovani-spv" className="text-sm text-accent-2 underline hover:text-accent">
          ← Sledování dodavatelů
        </Link>
        <h1 className="mt-1 text-2xl font-bold text-ink">{product.name}</h1>
        <p className="text-sm text-accent-2">
          {product.code}
          {!product.visible && " · skryto"}
          {product.slowerDelivery && " · jen z druhého skladu"} ·{" "}
          <Link href={`/admin/produkty/${product.id}`} className="underline hover:text-accent">
            otevřít produkt
          </Link>
        </p>
      </div>

      {points.length === 0 ? (
        <p className="rounded-sm border border-line bg-white p-4 text-sm text-accent-2">
          Pro tento produkt zatím nemáme žádnou historii dodavatele (zapisuje se při synchronizaci SP Venture / Tamda).
        </p>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatCard label="Sklad dodavatele nyní" value={`${last!.stock} ks`} hint={`min ${Math.min(...stocks)} / max ${Math.max(...stocks)} ks`} />
            <StatCard
              label="Nákup bez DPH nyní"
              value={`${last!.price.toFixed(2)} Kč`}
              hint={`min ${Math.min(...prices).toFixed(2)} / max ${Math.max(...prices).toFixed(2)} Kč`}
            />
            <StatCard label="Změn ceny" value={priceChanges} hint={`za ${Math.max(1, Math.round((now - first!.at.getTime()) / 86400000))} dní historie`} />
            <StatCard label="Záznamů" value={points.length} hint={`od ${formatDateTime(first!.at)}`} />
          </div>

          <StepChart
            title="Sklad dodavatele (ks)"
            points={points.map((p) => ({ at: p.at.getTime(), v: p.stock }))}
            now={now}
            format={(v) => String(Math.round(v))}
          />
          <StepChart
            title="Nákupní cena bez DPH (Kč)"
            points={points.map((p) => ({ at: p.at.getTime(), v: p.price }))}
            now={now}
            format={(v) => v.toFixed(1)}
          />

          <div className="overflow-x-auto rounded-sm border border-line bg-white">
            <table className="w-full min-w-[480px] text-sm">
              <thead className="border-b border-line bg-white text-left text-xs uppercase text-accent-2">
                <tr>
                  <th className="px-3 py-2">Kdy</th>
                  <th className="px-3 py-2">Sklad dodavatele</th>
                  <th className="px-3 py-2">Nákup bez DPH</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((p, i) => {
                  const older = points[points.length - 1 - i - 1] ?? null;
                  const dStock = older ? p.stock - older.stock : null;
                  const dPrice = older ? p.price - older.price : null;
                  return (
                    <tr key={p.at.toISOString()} className="border-b border-line last:border-0">
                      <td className="px-3 py-2 text-accent-2">{formatDateTime(p.at)}</td>
                      <td className="px-3 py-2">
                        {p.stock} ks
                        {dStock !== null && dStock !== 0 && (
                          <span className={dStock < 0 ? "ml-1 text-red-600" : "ml-1 text-ok"}>
                            ({dStock > 0 ? "+" : ""}
                            {dStock})
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2">
                        {p.price.toFixed(2)} Kč
                        {dPrice !== null && Math.abs(dPrice) > 0.004 && (
                          <span className={dPrice > 0 ? "ml-1 text-red-600" : "ml-1 text-ok"}>
                            ({dPrice > 0 ? "+" : ""}
                            {dPrice.toFixed(2)})
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
