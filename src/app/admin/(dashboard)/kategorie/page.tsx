import { prisma } from "@/lib/prisma";
import { getCategoryOptions } from "@/lib/admin/category-options.server";
import { createCategory, updateCategory, deleteCategory } from "@/lib/admin/actions/categories";
import { DeleteButton } from "@/components/admin/delete-button";

export default async function AdminCategoriesPage() {
  const [categories, options] = await Promise.all([
    prisma.category.findMany({
      orderBy: [{ sortOrder: "asc" }],
      include: { _count: { select: { products: true, children: true } } },
    }),
    getCategoryOptions(),
  ]);

  const byId = new Map(categories.map((c) => [c.id, c]));
  const depthOf = (id: string): number => {
    let d = 0;
    let current = byId.get(id);
    while (current?.parentId) {
      d++;
      current = byId.get(current.parentId);
    }
    return d;
  };

  return (
    <div className="flex flex-col gap-8">
      <h1 className="text-2xl font-bold text-ink">Kategorie ({categories.length})</h1>

      <div className="overflow-x-auto rounded-sm border border-line bg-white">
        <table className="w-full text-sm">
          <thead className="border-b border-line bg-white text-left text-xs uppercase text-accent-2">
            <tr>
              <th className="px-3 py-2">Název</th>
              <th className="px-3 py-2">Pořadí</th>
              <th className="px-3 py-2">Skrytá</th>
              <th className="px-3 py-2">Produkty</th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody>
            {categories.map((c) => (
              <tr key={c.id} className="border-b border-line last:border-0">
                <td className="px-3 py-2">
                  <form
                    action={updateCategory.bind(null, c.id)}
                    className="flex items-center gap-2"
                  >
                    <span className="text-accent-2">{"— ".repeat(depthOf(c.id))}</span>
                    <input
                      name="name"
                      defaultValue={c.name}
                      className="w-48 rounded border border-line px-2 py-1"
                    />
                    <input type="hidden" name="sortOrder" value={c.sortOrder} />
                    <input type="hidden" name="hidden" value={c.hidden ? "on" : ""} />
                    <button type="submit" className="text-xs text-accent-2 underline">
                      Uložit
                    </button>
                  </form>
                </td>
                <td className="px-3 py-2">
                  <form action={updateCategory.bind(null, c.id)} className="flex items-center gap-2">
                    <input type="hidden" name="name" value={c.name} />
                    <input
                      name="sortOrder"
                      type="number"
                      defaultValue={c.sortOrder}
                      className="w-16 rounded border border-line px-2 py-1"
                    />
                    <input type="hidden" name="hidden" value={c.hidden ? "on" : ""} />
                    <button type="submit" className="text-xs text-accent-2 underline">
                      Uložit
                    </button>
                  </form>
                </td>
                <td className="px-3 py-2">
                  <form action={updateCategory.bind(null, c.id)} className="flex items-center gap-2">
                    <input type="hidden" name="name" value={c.name} />
                    <input type="hidden" name="sortOrder" value={c.sortOrder} />
                    <input type="checkbox" name="hidden" defaultChecked={c.hidden} />
                    <button type="submit" className="text-xs text-accent-2 underline">
                      Uložit
                    </button>
                  </form>
                </td>
                <td className="px-3 py-2 text-accent-2">{c._count.products}</td>
                <td className="px-3 py-2">
                  {c._count.children === 0 && c._count.products === 0 && (
                    <DeleteButton
                      action={deleteCategory.bind(null, c.id)}
                      confirmMessage={`Smazat kategorii "${c.name}"?`}
                      label="Smazat"
                    />
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <section className="flex flex-col gap-3 rounded-sm border border-line bg-white p-4">
        <h2 className="text-sm font-semibold">Nová kategorie</h2>
        <form action={createCategory} className="flex flex-wrap items-end gap-3">
          <label className="flex flex-col gap-1 text-sm">
            Název
            <input name="name" required className="rounded border border-line px-2 py-1" />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            Nadřazená kategorie
            <select name="parentId" className="rounded border border-line px-2 py-1">
              <option value="">— kořenová kategorie —</option>
              {options.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm">
            Pořadí
            <input
              name="sortOrder"
              type="number"
              defaultValue={0}
              className="w-20 rounded border border-line px-2 py-1"
            />
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
