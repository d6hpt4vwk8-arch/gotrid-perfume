import { AdminNav, type NavGroup } from "@/components/admin/admin-nav";

// Grouped by what the owner is doing, not by feature age — the first group is what is opened every morning.
const NAV_GROUPS: NavGroup[] = [
  {
    title: "Prodej",
    items: [
      { href: "/admin", label: "Přehled" },
      { href: "/admin/objednavky", label: "Objednávky" },
      { href: "/admin/zakaznici", label: "Zákazníci" },
      { href: "/admin/faktury", label: "Faktury" },
      { href: "/admin/zdroje-objednavek", label: "Zdroje objednávek" },
      { href: "/admin/recenze", label: "Recenze" },
    ],
  },
  {
    title: "Katalog",
    items: [
      { href: "/admin/produkty", label: "Produkty" },
      { href: "/admin/kategorie", label: "Kategorie" },
      { href: "/admin/znacky", label: "Značky" },
      { href: "/admin/cenova-pozice", label: "Cenová pozice" },
      { href: "/admin/magazin", label: "Magazín" },
      { href: "/admin/hledani", label: "Vyhledávání" },
    ],
  },
  {
    title: "Sklad a dodavatelé",
    items: [
      { href: "/admin/vlastni-sklad", label: "Vlastní sklad" },
      { href: "/admin/prijem-skladu", label: "Příjem na sklad" },
      { href: "/admin/hlidac-skladu", label: "Hlídání skladem" },
      { href: "/admin/sledovani-spv", label: "Sledování dodavatelů" },
      { href: "/admin/import", label: "Import XLSX" },
    ],
  },
  {
    title: "Marketing",
    items: [
      { href: "/admin/slevove-kody", label: "Slevové kódy" },
      { href: "/admin/body-odmeny", label: "Body a odměny" },
      { href: "/admin/newsletter", label: "Newsletter" },
      { href: "/admin/email-marketing", label: "E-mail marketing" },
      { href: "/admin/oblibene", label: "Oblíbené" },
    ],
  },
  {
    title: "Systém",
    items: [
      { href: "/admin/nastaveni", label: "Nastavení" },
      { href: "/admin/log", label: "Log činností" },
    ],
  },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-white lg:flex-row">
      <AdminNav groups={NAV_GROUPS} />
      <main className="mx-auto w-full min-w-0 max-w-6xl flex-1 px-4 py-6 pb-24 lg:px-8 lg:py-8 lg:pb-8">{children}</main>
    </div>
  );
}
