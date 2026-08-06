import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { formatPrice } from "@/lib/format";

const PAGE_SIZE = 30;

export default async function AdminProductsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string }>;
}) {
  const { q, page: pageParam } = await searchParams;
  const query = (q ?? "").trim();
  const page = Math.max(1, Number(pageParam) || 1);

  const where = query
    ? {
        OR: [
          { name: { contains: query, mode: "insensitive" as const } },
          { code: { contains: query, mode: "insensitive" as const } },
          { ean: { contains: query, mode: "insensitive" as const } },
        ],
      }
    : {};

  const [products, total] = await Promise.all([
    prisma.product.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: { brand: true, images: { take: 1, orderBy: { sortOrder: "asc" } } },
    }),
    prisma.product.count({ where }),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-ink">Produkty ({total})</h1>
        <Link
          href="/admin/produkty/novy"
          className="rounded-sm bg-ink px-4 py-2 text-sm font-medium text-white hover:bg-accent"
        >
          + Nový produkt
        </Link>
      </div>

      <form className="flex gap-2">
        <input
          type="search"
          name="q"
          defaultValue={query}
          placeholder="Hledat podle názvu, kódu, EAN…"
          className="w-full max-w-sm rounded-sm border border-line px-3 py-1.5 text-sm"
        />
        <button type="submit" className="rounded-sm border border-line px-3 py-1.5 text-sm">
          Hledat
        </button>
      </form>

      <div className="overflow-x-auto rounded-sm border border-line bg-white">
        <table className="w-full min-w-[700px] text-sm">
          <thead className="border-b border-line bg-white text-left text-xs uppercase text-accent-2">
            <tr>
              <th className="px-3 py-2">Produkt</th>
              <th className="px-3 py-2">Kód</th>
              <th className="px-3 py-2">Značka</th>
              <th className="px-3 py-2">Cena</th>
              <th className="px-3 py-2">Sklad</th>
              <th className="px-3 py-2">Viditelný</th>
            </tr>
          </thead>
          <tbody>
            {products.map((p) => (
              <tr key={p.id} className="border-b border-line last:border-0 hover:bg-white">
                <td className="px-3 py-2">
                  <Link href={`/admin/produkty/${p.id}`} className="font-medium hover:underline">
                    {p.name}
                  </Link>
                </td>
                <td className="px-3 py-2 text-accent-2">{p.code}</td>
                <td className="px-3 py-2 text-accent-2">{p.brand?.name ?? "—"}</td>
                <td className="px-3 py-2">{formatPrice(p.price)}</td>
                <td className="px-3 py-2">{p.stock}</td>
                <td className="px-3 py-2">{p.visible ? "Ano" : "Ne"}</td>
              </tr>
            ))}
            {products.length === 0 && (
              <tr>
                <td colSpan={6} className="px-3 py-6 text-center text-accent-2">
                  Žádné produkty.
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
              href={`/admin/produkty?${new URLSearchParams({ ...(query ? { q: query } : {}), page: String(p) })}`}
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
