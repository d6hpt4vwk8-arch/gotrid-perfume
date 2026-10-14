"use client";

import { useLocale } from "next-intl";
import { useSearchParams } from "next/navigation";
import { usePathname } from "@/i18n/navigation";

// The visitor chooses a country; language and currency follow from it
// (Česko → Czech + Kč, Slovensko → Slovak + €).
const COUNTRIES = [
  { locale: "cs", short: "CZ", name: "Česko" },
  { locale: "sk", short: "SK", name: "Slovensko" },
] as const;

export function LanguageSwitcher() {
  const current = useLocale();
  const pathname = usePathname();
  const search = useSearchParams().toString();
  const path = search ? `${pathname}?${search}` : pathname;
  // Plain anchors with explicit prefixes: a locale-switching <Link> always
  // emits "/cs/..." for the default language, which then redirects.
  const hrefFor = (locale: "cs" | "sk") =>
    locale === "sk" ? (pathname === "/" ? `/sk${search ? `?${search}` : ""}` : `/sk${path}`) : path;

  return (
    <div className="flex items-center gap-0.5 text-xs font-semibold" role="group" aria-label="Česko / Slovensko">
      {COUNTRIES.map((c) => (
        <a
          key={c.locale}
          href={hrefFor(c.locale)}
          hrefLang={c.locale}
          title={c.name}
          aria-current={current === c.locale ? "true" : undefined}
          className={`rounded-sm px-1.5 py-1 ${
            current === c.locale ? "bg-white/15 text-white" : "text-white/60 hover:text-white"
          }`}
        >
          <span className="sm:hidden">{c.short}</span>
          <span className="hidden sm:inline">{c.name}</span>
        </a>
      ))}
    </div>
  );
}
