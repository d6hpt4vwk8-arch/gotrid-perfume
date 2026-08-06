import Link from "next/link";
import { prisma } from "@/lib/prisma";

export default async function AdminDashboardPage() {
  const [products, orders, newOrders, brands, categories] = await Promise.all([
    prisma.product.count(),
    prisma.order.count(),
    prisma.order.count({ where: { status: "NEW" } }),
    prisma.brand.count(),
    prisma.category.count(),
  ]);

  const stats = [
    { label: "Produkty", value: products, href: "/admin/produkty" },
    { label: "Nové objednávky", value: newOrders, href: "/admin/objednavky?status=NEW" },
    { label: "Objednávky celkem", value: orders, href: "/admin/objednavky" },
    { label: "Značky", value: brands, href: "/admin/znacky" },
    { label: "Kategorie", value: categories, href: "/admin/kategorie" },
  ];

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold text-ink">Přehled</h1>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-5">
        {stats.map((s) => (
          <Link
            key={s.label}
            href={s.href}
            className="rounded-sm border border-line bg-white p-4 hover:border-accent-2"
          >
            <div className="text-2xl font-bold text-ink">{s.value}</div>
            <div className="text-sm text-accent-2">{s.label}</div>
          </Link>
        ))}
      </div>
    </div>
  );
}
