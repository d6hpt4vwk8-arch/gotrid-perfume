"use client";

import { useRouter } from "next/navigation";
import { useCurrency } from "@/lib/currency-context";
import type { Currency } from "@/lib/currency-cookie";

export function CurrencySwitcher() {
  const { currency, setCurrency } = useCurrency();
  const router = useRouter();

  // setCurrency alone only re-renders client components reading useCurrency()
  // (e.g. ProductCard) — server components that format a price themselves
  // (home-hero, benefits-bar, the product page) read the cookie via headers()
  // at render time and need router.refresh() to actually re-run with it,
  // otherwise the page shows CZK and EUR side by side until the next navigation.
  function handleClick(next: Currency) {
    setCurrency(next);
    router.refresh();
  }

  // Stacked vertically (not side-by-side) so it stays narrow next to the
  // logo in the header — a horizontal CZK/EUR pair was crowding it on
  // narrow screens.
  return (
    <div className="flex flex-col overflow-hidden rounded-sm border border-white/20 text-[11px] leading-none font-semibold text-white/70">
      <button
        type="button"
        onClick={() => handleClick("CZK")}
        aria-pressed={currency === "CZK"}
        aria-label="Zobrazit ceny v korunách"
        className={`px-1.5 py-1 ${currency === "CZK" ? "bg-white/15 text-white" : "hover:text-white"}`}
      >
        Kč
      </button>
      <button
        type="button"
        onClick={() => handleClick("EUR")}
        aria-pressed={currency === "EUR"}
        aria-label="Zobrazit ceny v eurech"
        className={`border-t border-white/20 px-1.5 py-1 ${currency === "EUR" ? "bg-white/15 text-white" : "hover:text-white"}`}
      >
        €
      </button>
    </div>
  );
}
