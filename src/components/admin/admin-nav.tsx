"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { LogoutButton } from "@/components/admin/logout-button";

export interface NavGroup {
  title: string;
  items: { href: string; label: string }[];
}

// The four things used most from a phone — always one tap away in the bottom bar.
const QUICK = [
  { href: "/admin", label: "Přehled", icon: "M3 12l9-8 9 8M5 10v10h5v-6h4v6h5V10" },
  { href: "/admin/objednavky", label: "Objednávky", icon: "M4 6h16M4 12h16M4 18h10" },
  { href: "/admin/produkty", label: "Produkty", icon: "M12 3l8 4.5v9L12 21l-8-4.5v-9L12 3zM12 12l8-4.5M12 12v9M12 12L4 7.5" },
  { href: "/admin/hledani", label: "Hledat", icon: "M11 4a7 7 0 100 14 7 7 0 000-14zM20 20l-4-4" },
];

function isActive(pathname: string, href: string) {
  return href === "/admin" ? pathname === "/admin" : pathname === href || pathname.startsWith(`${href}/`);
}

function Groups({ groups, pathname, onNavigate }: { groups: NavGroup[]; pathname: string; onNavigate?: () => void }) {
  return (
    <div className="flex flex-col gap-5">
      {groups.map((g) => (
        <div key={g.title} className="flex flex-col gap-0.5">
          <div className="px-3 pb-1 text-[11px] font-semibold uppercase tracking-wider text-white/40">{g.title}</div>
          {g.items.map((item) => {
            const active = isActive(pathname, item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onNavigate}
                aria-current={active ? "page" : undefined}
                className={`rounded-sm px-3 py-1.5 text-sm ${
                  active ? "bg-white/15 font-medium text-white" : "text-white/70 hover:bg-white/10 hover:text-white"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </div>
      ))}
    </div>
  );
}

function Brand() {
  return (
    <Link href="/admin" className="flex shrink-0 items-center gap-2.5">
      <Image src="/logo.svg" alt="Gotrid Perfume" width={26} height={26} className="brightness-0 invert" />
      <span className="font-semibold text-white">Administrace</span>
    </Link>
  );
}

export function AdminNav({ groups }: { groups: NavGroup[] }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  // Close the drawer after navigating, and lock page scroll while it is open.
  useEffect(() => setOpen(false), [pathname]);
  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  return (
    <>
      {/* Desktop: fixed grouped sidebar */}
      <aside className="sticky top-0 hidden h-screen w-56 shrink-0 flex-col gap-5 overflow-y-auto bg-ink px-2 py-4 lg:flex">
        <div className="px-3">
          <Brand />
        </div>
        <Groups groups={groups} pathname={pathname} />
        <div className="mt-auto px-3 pt-4">
          <LogoutButton />
        </div>
      </aside>

      {/* Phone / tablet: slim top bar + drawer + bottom quick bar */}
      <header className="sticky top-0 z-30 flex items-center justify-between bg-ink px-4 py-2.5 lg:hidden">
        <Brand />
        <button
          type="button"
          aria-label="Menu"
          aria-expanded={open}
          onClick={() => setOpen((o) => !o)}
          className="rounded-sm p-2 text-white hover:bg-white/10"
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            {open ? <path d="M6 6l12 12M18 6L6 18" /> : <path d="M4 7h16M4 12h16M4 17h16" />}
          </svg>
        </button>
      </header>

      {open && (
        <div className="fixed inset-0 z-20 overflow-y-auto bg-ink px-3 pb-24 pt-16 lg:hidden">
          <Groups groups={groups} pathname={pathname} onNavigate={() => setOpen(false)} />
          <div className="mt-6 px-3">
            <LogoutButton />
          </div>
        </div>
      )}

      <nav
        aria-label="Rychlá navigace"
        className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-5 border-t border-white/10 bg-ink pb-[env(safe-area-inset-bottom)] lg:hidden"
      >
        {QUICK.map((q) => {
          const active = !open && isActive(pathname, q.href);
          return (
            <Link
              key={q.href}
              href={q.href}
              className={`flex flex-col items-center gap-0.5 py-2 text-[11px] ${active ? "text-white" : "text-white/60"}`}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d={q.icon} />
              </svg>
              {q.label}
            </Link>
          );
        })}
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className={`flex flex-col items-center gap-0.5 py-2 text-[11px] ${open ? "text-white" : "text-white/60"}`}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
            <path d="M4 7h16M4 12h16M4 17h16" />
          </svg>
          Více
        </button>
      </nav>
    </>
  );
}
