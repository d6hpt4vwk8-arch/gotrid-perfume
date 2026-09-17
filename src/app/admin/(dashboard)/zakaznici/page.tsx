import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { formatPrice } from "@/lib/format";

const REAL_ORDER_STATUSES = ["NEW", "PAID", "PROCESSING", "SHIPPED", "DELIVERED"] as const;

interface CustomerRow {
  email: string;
  name: string;
  phone: string;
  hasAccount: boolean;
  marketingOptIn: boolean;
  orderCount: number;
  totalSpent: number;
  firstOrderAt: Date;
  lastOrderAt: Date;
}

// 108 of 111 orders are guest checkouts (no Customer row) — a list scoped
// to the Customer table alone would show almost nobody. This groups by
// email across every real order instead, so it actually reflects who buys
// from us, joining in Customer only for account/marketing-opt-in status
// where an account happens to exist.
export default async function AdminCustomersPage() {
  const [orders, customers] = await Promise.all([
    prisma.order.findMany({
      where: { status: { in: [...REAL_ORDER_STATUSES] } },
      select: {
        email: true,
        firstName: true,
        lastName: true,
        phone: true,
        customerId: true,
        total: true,
        createdAt: true,
      },
      orderBy: { createdAt: "asc" },
    }),
    prisma.customer.findMany({ select: { email: true, marketingOptIn: true } }),
  ]);

  const marketingOptInByEmail = new Map(
    customers.map((c) => [c.email.toLowerCase(), c.marketingOptIn]),
  );

  const byEmail = new Map<string, CustomerRow>();
  for (const o of orders) {
    const key = o.email.trim().toLowerCase();
    const existing = byEmail.get(key);
    if (existing) {
      existing.orderCount += 1;
      existing.totalSpent += Number(o.total);
      existing.lastOrderAt = o.createdAt;
      if (o.customerId) existing.hasAccount = true;
    } else {
      byEmail.set(key, {
        email: o.email,
        name: `${o.firstName} ${o.lastName}`.trim(),
        phone: o.phone,
        hasAccount: Boolean(o.customerId),
        marketingOptIn: marketingOptInByEmail.get(key) ?? false,
        orderCount: 1,
        totalSpent: Number(o.total),
        firstOrderAt: o.createdAt,
        lastOrderAt: o.createdAt,
      });
    }
  }

  const rows = [...byEmail.values()].sort((a, b) => b.totalSpent - a.totalSpent);
  const repeatCount = rows.filter((r) => r.orderCount > 1).length;

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-bold text-ink">Zákazníci ({rows.length})</h1>
        <p className="text-sm text-accent-2">
          {repeatCount} z nich objednalo víckrát než jednou · {customers.length} má založený účet
        </p>
      </div>

      <div className="overflow-x-auto rounded-sm border border-line bg-white">
        <table className="w-full min-w-[800px] text-sm">
          <thead className="border-b border-line bg-white text-left text-xs uppercase text-accent-2">
            <tr>
              <th className="px-3 py-2">Jméno</th>
              <th className="px-3 py-2">Kontakt</th>
              <th className="px-3 py-2">Účet</th>
              <th className="px-3 py-2">Objednávky</th>
              <th className="px-3 py-2">Celkem utraceno</th>
              <th className="px-3 py-2">První / poslední objednávka</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.email} className="border-b border-line last:border-0">
                <td className="px-3 py-2 font-medium">{r.name || "—"}</td>
                <td className="px-3 py-2">
                  <Link
                    href={`/admin/objednavky?q=${encodeURIComponent(r.email)}`}
                    className="underline hover:text-accent"
                  >
                    {r.email}
                  </Link>
                  <div className="text-xs text-accent-2">{r.phone}</div>
                </td>
                <td className="whitespace-nowrap px-3 py-2 text-accent-2">
                  {r.hasAccount ? "Ano" : "Host"}
                  {r.marketingOptIn && " · newsletter"}
                </td>
                <td className="px-3 py-2">
                  {r.orderCount}
                  {r.orderCount > 1 && (
                    <span
                      title="Stálý zákazník"
                      className="ml-1.5 rounded-full bg-ok/10 px-1.5 py-0.5 text-xs font-medium text-ok"
                    >
                      opakovaně
                    </span>
                  )}
                </td>
                <td className="px-3 py-2 font-medium">{formatPrice(r.totalSpent)}</td>
                <td className="whitespace-nowrap px-3 py-2 text-xs text-accent-2">
                  {r.firstOrderAt.toLocaleDateString("cs-CZ")}
                  {r.orderCount > 1 && ` – ${r.lastOrderAt.toLocaleDateString("cs-CZ")}`}
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={6} className="px-3 py-4 text-center text-accent-2">
                  Zatím žádní zákazníci.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
