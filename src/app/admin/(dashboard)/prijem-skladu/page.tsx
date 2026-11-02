import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { ReceivingScanner } from "@/components/admin/receiving-scanner";

const UNKNOWN_WINDOW_DAYS = 90;

export default async function ReceivingPage() {
  const since = new Date(Date.now() - UNKNOWN_WINDOW_DAYS * 24 * 60 * 60 * 1000);
  const rows = await prisma.adminActivityLog.findMany({
    where: { action: { in: ["receiving.unknown_ean", "receiving.unknown_resolved"] }, createdAt: { gte: since } },
    orderBy: { createdAt: "asc" },
    select: { action: true, entityId: true, detail: true },
  });

  // An EAN stays on the list until a "resolved" row follows it (written when the product has been created and
  // the counted units booked); anything scanned again after that starts a fresh count.
  const pending = new Map<string, number>();
  for (const r of rows) {
    if (!r.entityId) continue;
    if (r.action === "receiving.unknown_resolved") pending.delete(r.entityId);
    else pending.set(r.entityId, (pending.get(r.entityId) ?? 0) + (Number(r.detail) || 1));
  }
  const unknown = [...pending.entries()];

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-bold text-ink">Příjem na sklad</h1>
      <p className="text-sm text-accent-2">
        Naskenujte čárové kódy zboží, které přibývá do vlastního skladu (zbytky, vratky, dokoupené kusy). Každé načtení
        přidá 1 ks, počet lze opravit ručně. Po stisku „Zapsat na sklad“ se kusy přičtou k poli „Vlastní sklad“ produktu
        (nepřepisují se). Kód, který v katalogu není, se uloží do seznamu níže.
      </p>

      <ReceivingScanner />

      <div className="flex flex-col gap-2">
        <h2 className="text-lg font-semibold text-ink">Neznámé EAN k doplnění ({unknown.length})</h2>
        {unknown.length === 0 ? (
          <p className="text-sm text-accent-2">Nic nečeká — všechny naskenované kódy byly v katalogu.</p>
        ) : (
          <div className="overflow-x-auto rounded-sm border border-line bg-white">
            <table className="w-full text-sm">
              <thead className="border-b border-line text-left text-xs uppercase text-accent-2">
                <tr>
                  <th className="px-3 py-2">EAN</th>
                  <th className="px-3 py-2">Naskenováno</th>
                </tr>
              </thead>
              <tbody>
                {unknown.map(([ean, qty]) => (
                  <tr key={ean} className="border-b border-line last:border-0">
                    <td className="px-3 py-2 font-mono text-xs">{ean}</td>
                    <td className="px-3 py-2 font-semibold">{qty} ks</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="text-xs text-accent-2">
          Produkty se z těchto kódů zakládají v chatu s Claude („rozeber neznámé EAN“); po založení se řádek odškrtne.
          Historii najdete také v <Link href="/admin/log" className="underline">logu činností</Link>.
        </p>
      </div>
    </div>
  );
}
