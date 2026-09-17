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

  return (
    <div className="flex items-center overflow-hidden rounded-sm border border-white/20 text-xs font-semibold text-white/70">
      <button
        type="button"
        onClick={() => handleClick("CZK")}
        aria-pressed={currency === "CZK"}
        className={`px-2 py-1 ${currency === "CZK" ? "bg-white/15 text-white" : "hover:text-white"}`}
      >
        CZK
      </button>
      <button
        type="button"
        onClick={() => handleClick("EUR")}
        aria-pressed={currency === "EUR"}
        className={`px-2 py-1 ${currency === "EUR" ? "bg-white/15 text-white" : "hover:text-white"}`}
      >
        EUR
      </button>
    </div>
  );
}
