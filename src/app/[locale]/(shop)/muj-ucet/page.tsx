import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { formatPrice } from "@/lib/format";
import { ORDER_STATUS_LABELS } from "@/lib/orders/status-labels";
import { getCurrentCustomer } from "@/lib/customer/get-current-customer";
import { updateSavedAddress, updateMarketingOptIn } from "@/lib/customer/actions";
import { CustomerLogoutButton } from "@/components/customer/logout-button";

export default async function AccountPage() {
  const customer = await getCurrentCustomer();
  if (!customer) redirect("/prihlaseni?next=/muj-ucet");

  const orders = await prisma.order.findMany({
    where: { customerId: customer.id },
    orderBy: { createdAt: "desc" },
  });

  return (
    <main className="mx-auto flex max-w-3xl flex-1 flex-col gap-10 px-4 py-10">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-ink">Můj účet</h1>
          <p className="text-sm text-accent-2">{customer.email}</p>
        </div>
        <CustomerLogoutButton />
      </div>

      <section className="flex flex-col gap-4">
        <h2 className="text-lg font-bold text-ink">Historie objednávek</h2>
        {orders.length === 0 ? (
          <p className="text-sm text-accent-2">Zatím žádné objednávky.</p>
        ) : (
          <ul className="flex flex-col divide-y divide-line border-y border-line">
            {orders.map((order) => (
              <li key={order.id} className="flex items-center justify-between py-3 text-sm">
                <div className="flex flex-col gap-0.5">
                  <Link
                    href={`/objednavka/${order.number}`}
                    className="font-semibold text-ink hover:underline"
                  >
                    {order.number}
                  </Link>
                  <span className="text-xs text-accent-2">
                    {new Date(order.createdAt).toLocaleDateString("cs-CZ")} ·{" "}
                    {ORDER_STATUS_LABELS[order.status]}
                  </span>
                </div>
                <span className="font-bold text-accent">{formatPrice(order.total)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="text-lg font-bold text-ink">Uložená adresa</h2>
        <p className="text-sm text-accent-2">
          Tyto údaje se automaticky předvyplní při příští objednávce.
        </p>
        <form action={updateSavedAddress} className="flex flex-col gap-3 max-w-sm">
          <div className="flex gap-3">
            <input
              name="firstName"
              required
              placeholder="Jméno"
              defaultValue={customer.firstName ?? ""}
              className="w-full rounded-sm border border-line px-3 py-2 text-sm text-ink"
            />
            <input
              name="lastName"
              required
              placeholder="Příjmení"
              defaultValue={customer.lastName ?? ""}
              className="w-full rounded-sm border border-line px-3 py-2 text-sm text-ink"
            />
          </div>
          <input
            name="phone"
            type="tel"
            placeholder="Telefon"
            defaultValue={customer.phone ?? ""}
            className="rounded-sm border border-line px-3 py-2 text-sm text-ink"
          />
          <input
            name="addressStreet"
            placeholder="Ulice a číslo popisné"
            defaultValue={customer.addressStreet ?? ""}
            className="rounded-sm border border-line px-3 py-2 text-sm text-ink"
          />
          <div className="flex gap-3">
            <input
              name="addressCity"
              placeholder="Město"
              defaultValue={customer.addressCity ?? ""}
              className="w-full rounded-sm border border-line px-3 py-2 text-sm text-ink"
            />
            <input
              name="addressPostalCode"
              placeholder="PSČ"
              defaultValue={customer.addressPostalCode ?? ""}
              className="w-full rounded-sm border border-line px-3 py-2 text-sm text-ink"
            />
          </div>
          <button
            type="submit"
            className="w-fit rounded-sm bg-ink px-5 py-2.5 text-sm font-semibold text-white hover:bg-accent"
          >
            Uložit
          </button>
        </form>
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="text-lg font-bold text-ink">Odběr novinek</h2>
        <form action={updateMarketingOptIn} className="flex flex-col gap-3 max-w-sm">
          <label className="flex items-center gap-2 text-sm text-ink">
            <input
              type="checkbox"
              name="marketingOptIn"
              defaultChecked={customer.marketingOptIn}
            />
            Chci dostávat novinky a slevy e-mailem.
          </label>
          <button
            type="submit"
            className="w-fit rounded-sm bg-ink px-5 py-2.5 text-sm font-semibold text-white hover:bg-accent"
          >
            Uložit
          </button>
        </form>
      </section>
    </main>
  );
}
