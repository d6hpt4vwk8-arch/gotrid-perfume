import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { formatPrice } from "@/lib/format";
import { WISHLIST_EMAIL_ACTION } from "@/lib/marketing/wishlist-campaign";

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-sm border border-line bg-white p-4">
      <span className="block text-xs uppercase text-accent-2">{label}</span>
      <span className="block text-2xl font-bold text-ink">{value}</span>
    </div>
  );
}

// Favourites of logged-in customers (WishlistItem): which products people
// want but have not bought, and who they are. Guests' hearts stay in their
// browser and cannot be seen here. The daily job (wishlist-campaign.ts) mails
// opted-in customers about a price drop or the last few units.
export default async function AdminWishlistPage() {
  const [items, customerCount, optInCount, emailsSent] = await Promise.all([
    prisma.wishlistItem.findMany({
      select: {
        priceAtAdd: true,
        product: { select: { id: true, name: true, code: true, price: true, stock: true, ownStock: true } },
        customer: { select: { id: true, email: true, firstName: true, marketingOptIn: true } },
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.customer.count(),
    prisma.customer.count({ where: { marketingOptIn: true } }),
    prisma.adminActivityLog.count({ where: { action: WISHLIST_EMAIL_ACTION } }),
  ]);

  const byProduct = new Map<string, { product: (typeof items)[number]["product"]; who: string[]; optIn: number }>();
  const byCustomer = new Map<string, { email: string; name: string; optIn: boolean; count: number }>();
  for (const it of items) {
    const p = byProduct.get(it.product.id) ?? { product: it.product, who: [], optIn: 0 };
    p.who.push(it.customer.email);
    if (it.customer.marketingOptIn) p.optIn += 1;
    byProduct.set(it.product.id, p);
    const c = byCustomer.get(it.customer.id) ?? {
      email: it.customer.email,
      name: it.customer.firstName ?? "",
      optIn: it.customer.marketingOptIn,
      count: 0,
    };
    c.count += 1;
    byCustomer.set(it.customer.id, c);
  }
  const products = [...byProduct.values()].sort((a, b) => b.who.length - a.who.length);
  const customers = [...byCustomer.values()].sort((a, b) => b.count - a.count);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold text-ink">Oblíbené produkty</h1>
        <p className="text-sm text-accent-2">
          Co mají v oblíbených přihlášení zákazníci. Hosté se tu neukážou — jejich seznam zůstává jen
          v jejich prohlížeči. Denní úloha pošle zákazníkům se souhlasem e-mail při poklesu ceny o
          5 % a víc nebo když zbývají poslední 3 ks (max. 1× týdně).
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-4">
        <StatCard label="Položek v oblíbených" value={items.length} />
        <StatCard label="Zákazníků s účtem" value={customerCount} />
        <StatCard label="…se souhlasem s e-maily" value={optInCount} />
        <StatCard label="Odeslaných e-mailů" value={emailsSent} />
      </div>

      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-bold text-ink">Nejžádanější produkty</h2>
        {products.length === 0 ? (
          <p className="text-sm text-accent-2">Zatím nikdo nic nepřidal. Seznam se plní, jakmile se přihlášený zákazník označí produkt srdíčkem.</p>
        ) : (
          <table className="w-full text-left text-sm">
            <thead className="border-b border-line text-xs uppercase text-accent-2">
              <tr>
                <th className="py-2">Produkt</th>
                <th>Kdo to chce</th>
                <th className="text-right">Cena</th>
                <th className="text-right">Sklad</th>
              </tr>
            </thead>
            <tbody>
              {products.map(({ product, who, optIn }) => (
                <tr key={product.id} className="border-b border-line align-top">
                  <td className="py-2">
                    <Link href={`/admin/produkty/${product.id}`} className="font-medium text-ink hover:underline">
                      {product.name}
                    </Link>
                    <span className="block text-xs text-accent-2">{product.code}</span>
                  </td>
                  <td className="py-2 text-xs text-accent-2">
                    {who.length}× ({optIn} se souhlasem)
                    <span className="block">{who.slice(0, 4).join(", ")}{who.length > 4 ? "…" : ""}</span>
                  </td>
                  <td className="py-2 text-right">{formatPrice(product.price)}</td>
                  <td className="py-2 text-right">
                    {product.stock} ks{product.ownStock > 0 ? ` (vlastní ${product.ownStock})` : ""}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-bold text-ink">Zákazníci podle počtu oblíbených</h2>
        <table className="w-full text-left text-sm">
          <thead className="border-b border-line text-xs uppercase text-accent-2">
            <tr>
              <th className="py-2">Zákazník</th>
              <th>E-maily</th>
              <th className="text-right">Oblíbených</th>
            </tr>
          </thead>
          <tbody>
            {customers.map((c) => (
              <tr key={c.email} className="border-b border-line">
                <td className="py-2">
                  {c.name} <span className="text-xs text-accent-2">{c.email}</span>
                </td>
                <td className="py-2 text-xs">{c.optIn ? "souhlas ✓" : "bez souhlasu"}</td>
                <td className="py-2 text-right">{c.count}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
