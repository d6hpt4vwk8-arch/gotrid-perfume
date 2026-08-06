import Image from "next/image";
import Link from "next/link";
import { LogoutButton } from "@/components/admin/logout-button";

const NAV_ITEMS = [
  { href: "/admin", label: "Přehled" },
  { href: "/admin/produkty", label: "Produkty" },
  { href: "/admin/kategorie", label: "Kategorie" },
  { href: "/admin/znacky", label: "Značky" },
  { href: "/admin/objednavky", label: "Objednávky" },
  { href: "/admin/slevove-kody", label: "Slevové kódy" },
  { href: "/admin/import", label: "Import XLSX" },
  { href: "/admin/nastaveni", label: "Nastavení" },
  { href: "/admin/log", label: "Log činností" },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-white">
      <header className="bg-ink">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-6">
            <Link href="/admin" className="flex items-center gap-2.5">
              <Image
                src="/logo.svg"
                alt="Gotrid Perfume"
                width={26}
                height={26}
                className="brightness-0 invert"
              />
              <span className="font-semibold text-white">Administrace</span>
            </Link>
            <nav className="flex flex-wrap gap-4 text-sm text-white/70">
              {NAV_ITEMS.slice(1).map((item) => (
                <Link key={item.href} href={item.href} className="hover:text-white">
                  {item.label}
                </Link>
              ))}
            </nav>
          </div>
          <LogoutButton />
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">{children}</main>
    </div>
  );
}
