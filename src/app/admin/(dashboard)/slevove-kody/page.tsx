import { prisma } from "@/lib/prisma";
import { createCoupon, updateCoupon, deleteCoupon } from "@/lib/admin/actions/coupons";
import { DeleteButton } from "@/components/admin/delete-button";

function formatDateInput(date: Date | null): string {
  if (!date) return "";
  return date.toISOString().slice(0, 10);
}

export default async function AdminCouponsPage() {
  const coupons = await prisma.coupon.findMany({ orderBy: { createdAt: "desc" } });

  return (
    <div className="flex flex-col gap-8">
      <h1 className="text-2xl font-bold text-ink">Slevové kódy ({coupons.length})</h1>

      <ul className="flex flex-col gap-3">
        {coupons.map((c) => (
          <li key={c.id} className="rounded-sm border border-line bg-white p-4">
            <form
              action={updateCoupon.bind(null, c.id)}
              className="flex flex-wrap items-end gap-3 text-sm"
            >
              <label className="flex flex-col gap-1">
                Kód
                <input
                  name="code"
                  defaultValue={c.code}
                  className="w-28 rounded border border-line px-2 py-1 uppercase"
                />
              </label>
              <label className="flex flex-col gap-1">
                Typ
                <select
                  name="type"
                  defaultValue={c.type}
                  className="rounded border border-line px-2 py-1"
                >
                  <option value="PERCENT">% sleva</option>
                  <option value="FIXED">Kč sleva</option>
                </select>
              </label>
              <label className="flex flex-col gap-1">
                Hodnota
                <input
                  name="value"
                  type="number"
                  step="0.01"
                  defaultValue={Number(c.value)}
                  className="w-20 rounded border border-line px-2 py-1"
                />
              </label>
              <label className="flex flex-col gap-1">
                Min. objednávka (Kč)
                <input
                  name="minOrderValue"
                  type="number"
                  step="0.01"
                  defaultValue={c.minOrderValue ? Number(c.minOrderValue) : ""}
                  className="w-24 rounded border border-line px-2 py-1"
                />
              </label>
              <label className="flex flex-col gap-1">
                Limit / použito
                <span className="flex items-center gap-1">
                  <input
                    name="usageLimit"
                    type="number"
                    defaultValue={c.usageLimit ?? ""}
                    className="w-16 rounded border border-line px-2 py-1"
                  />
                  <span className="text-xs text-accent-2">/ {c.usedCount}</span>
                </span>
              </label>
              <label className="flex flex-col gap-1">
                Platnost do
                <input
                  name="expiresAt"
                  type="date"
                  defaultValue={formatDateInput(c.expiresAt)}
                  className="rounded border border-line px-2 py-1"
                />
              </label>
              <label className="flex items-center gap-2 pb-1.5">
                <input type="checkbox" name="active" defaultChecked={c.active} />
                Aktivní
              </label>
              <button type="submit" className="text-xs text-accent-2 underline">
                Uložit
              </button>
              <span className="ml-auto">
                <DeleteButton
                  action={deleteCoupon.bind(null, c.id)}
                  confirmMessage={`Smazat kód "${c.code}"?`}
                />
              </span>
            </form>
          </li>
        ))}
      </ul>

      <section className="flex flex-col gap-3 rounded-sm border border-line bg-white p-4">
        <h2 className="text-sm font-semibold">Nový slevový kód</h2>
        <form action={createCoupon} className="flex flex-wrap items-end gap-3">
          <label className="flex flex-col gap-1 text-sm">
            Kód
            <input name="code" required className="w-32 rounded border border-line px-2 py-1 uppercase" />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            Typ
            <select name="type" className="rounded border border-line px-2 py-1">
              <option value="PERCENT">% sleva</option>
              <option value="FIXED">Kč sleva</option>
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm">
            Hodnota
            <input name="value" type="number" step="0.01" required className="w-24 rounded border border-line px-2 py-1" />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            Min. objednávka (Kč)
            <input name="minOrderValue" type="number" step="0.01" className="w-28 rounded border border-line px-2 py-1" />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            Limit použití
            <input name="usageLimit" type="number" className="w-24 rounded border border-line px-2 py-1" />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            Platnost do
            <input name="expiresAt" type="date" className="rounded border border-line px-2 py-1" />
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="active" defaultChecked />
            Aktivní
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
