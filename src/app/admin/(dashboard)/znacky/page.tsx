import { prisma } from "@/lib/prisma";
import { createBrand, updateBrand, deleteBrand } from "@/lib/admin/actions/brands";
import { DeleteButton } from "@/components/admin/delete-button";

export default async function AdminBrandsPage() {
  const brands = await prisma.brand.findMany({
    orderBy: { name: "asc" },
    include: { _count: { select: { products: true } } },
  });

  return (
    <div className="flex flex-col gap-8">
      <h1 className="text-2xl font-bold text-ink">Značky ({brands.length})</h1>

      <div className="overflow-x-auto rounded-sm border border-line bg-white">
        <table className="w-full text-sm">
          <thead className="border-b border-line bg-white text-left text-xs uppercase text-accent-2">
            <tr>
              <th className="px-3 py-2">Název</th>
              <th className="px-3 py-2">Produkty</th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody>
            {brands.map((b) => (
              <tr key={b.id} className="border-b border-line last:border-0">
                <td className="px-3 py-2">
                  <form action={updateBrand.bind(null, b.id)} className="flex items-center gap-2">
                    <input
                      name="name"
                      defaultValue={b.name}
                      className="w-56 rounded border border-line px-2 py-1"
                    />
                    <button type="submit" className="text-xs text-accent-2 underline">
                      Uložit
                    </button>
                  </form>
                </td>
                <td className="px-3 py-2 text-accent-2">{b._count.products}</td>
                <td className="px-3 py-2">
                  {b._count.products === 0 && (
                    <DeleteButton
                      action={deleteBrand.bind(null, b.id)}
                      confirmMessage={`Smazat značku "${b.name}"?`}
                    />
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <section className="flex flex-col gap-3 rounded-sm border border-line bg-white p-4">
        <h2 className="text-sm font-semibold">Nová značka</h2>
        <form action={createBrand} className="flex items-end gap-3">
          <label className="flex flex-col gap-1 text-sm">
            Název
            <input name="name" required className="rounded border border-line px-2 py-1" />
          </label>
          <button
            type="submit"
            className="rounded-sm bg-ink px-4 py-2 text-sm font-medium text-white hover:bg-accent"
          >
            Vytvořit
          </button>
        </form>
      </section>
    </div>
  );
}
