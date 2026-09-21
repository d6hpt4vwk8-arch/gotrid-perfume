import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { formatPrice } from "@/lib/format";

const VELOCITY_WINDOW_DAYS = 60;

export default async function OwnStockPage() {
  const since = new Date(Date.now() - VELOCITY_WINDOW_DAYS * 24 * 60 * 60 * 1000);

  const [products, soldRows] = await Promise.all([
    prisma.product.findMany({
      where: { ownStock: { gt: 0 } },
      select: {
        id: true,
        name: true,
        slug: true,
        ownStock: true,
        stock: true,
        purchasePrice: true,
        price: true,
        brand: { select: { name: true } },
      },
    }),
    prisma.orderItem.groupBy({
      by: ["productId"],
      where: {
        order: { createdAt: { gte: since }, status: { notIn: ["CANCELLED"] } },
        productId: { not: null },
      },
      _sum: { qty: true },
    }),
  ]);

  const soldByProductId = new Map(soldRows.map((r) => [r.productId, r._sum.qty ?? 0]));

  // Days of runway at the current 60-day sales pace — the whole point of
  // this page: surface what's about to run out first, not just list
  // everything alphabetically. No recent sales at all means "unknown", not
  // "infinite" — sorts last rather than implying it's safe.
  const rows = products
    .map((p) => {
      const sold60d = soldByProductId.get(p.id) ?? 0;
      const dailyVelocity = sold60d / VELOCITY_WINDOW_DAYS;
      const daysRemaining = dailyVelocity > 0 ? p.ownStock / dailyVelocity : null;
      return { ...p, sold60d, daysRemaining };
    })
    .sort((a, b) => {
      if (a.daysRemaining === null && b.daysRemaining === null) return b.ownStock - a.ownStock;
      if (a.daysRemaining === null) return 1;
      if (b.daysRemaining === null) return -1;
      return a.daysRemaining - b.daysRemaining;
    });

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-ink">Vlastní sklad ({rows.length})</h1>
      </div>
      <p className="text-sm text-accent-2">
        Produkty, které fyzicky máme u sebe (pole „Vlastní sklad“ na kartě produktu) — na
        rozdíl od „Sklad“, které jen odráží dostupnost u dodavatele. Tyto produkty se zároveň
        zobrazují přednostně na webu (hlavní stránka, kategorie, podobné produkty, košík).
      </p>

      <div className="overflow-x-auto rounded-sm border border-line bg-white">
        <table className="w-full min-w-[700px] text-sm">
          <thead className="border-b border-line bg-white text-left text-xs uppercase text-accent-2">
            <tr>
              <th className="px-3 py-2">Produkt</th>
              <th className="px-3 py-2">Vlastní sklad</th>
              <th className="px-3 py-2">Sklad (dodavatel)</th>
              <th className="px-3 py-2">Prodáno za {VELOCITY_WINDOW_DAYS} dní</th>
              <th className="px-3 py-2">Vydrží</th>
              <th className="px-3 py-2">Nákupní cena</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((p) => (
              <tr key={p.id} className="border-b border-line last:border-0 hover:bg-white">
                <td className="px-3 py-2">
                  <Link href={`/admin/produkty/${p.id}`} className="font-medium hover:underline">
                    {p.name}
                  </Link>
                  {p.brand && <div className="text-xs text-accent-2">{p.brand.name}</div>}
                </td>
                <td className="px-3 py-2 font-semibold">{p.ownStock} ks</td>
                <td className="px-3 py-2 text-accent-2">{p.stock} ks</td>
                <td className="px-3 py-2">{p.sold60d} ks</td>
                <td className="px-3 py-2">
                  {p.daysRemaining === null ? (
                    <span className="text-accent-2">bez nedávného prodeje</span>
                  ) : p.daysRemaining <= 14 ? (
                    <span className="font-medium text-red-600">
                      ~{Math.round(p.daysRemaining)} dní — brzy dojde
                    </span>
                  ) : (
                    <span>~{Math.round(p.daysRemaining)} dní</span>
                  )}
                </td>
                <td className="px-3 py-2">{formatPrice(p.purchasePrice)}</td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={6} className="px-3 py-6 text-center text-accent-2">
                  Zatím žádný produkt nemá vyplněný vlastní sklad. Nastavte ho na kartě
                  produktu (pole „Vlastní sklad (ks)“).
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
