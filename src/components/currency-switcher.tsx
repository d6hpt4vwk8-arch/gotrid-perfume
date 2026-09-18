"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useCurrency } from "@/lib/currency-context";
import type { Currency } from "@/lib/currency-cookie";

const OPTIONS: { value: Currency; symbol: string; name: string }[] = [
  { value: "CZK", symbol: "Kč", name: "Koruny" },
  { value: "EUR", symbol: "€", name: "Eura" },
];

export function CurrencySwitcher() {
  const { currency, setCurrency } = useCurrency();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onClickOutside(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, [open]);

  // setCurrency alone only re-renders client components reading useCurrency()
  // (e.g. ProductCard) — server components that format a price themselves
  // (home-hero, benefits-bar, the product page) read the cookie via headers()
  // at render time and need router.refresh() to actually re-run with it,
  // otherwise the page shows CZK and EUR side by side until the next navigation.
  function handleSelect(next: Currency) {
    setCurrency(next);
    setOpen(false);
    router.refresh();
  }

  const current = OPTIONS.find((o) => o.value === currency) ?? OPTIONS[0];

  return (
    <div ref={rootRef} className="relative text-white/70">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label="Vybrat měnu"
        className="flex items-center gap-1 rounded-sm border border-white/20 px-2 py-1 text-xs font-semibold hover:text-white"
      >
        {current.symbol}
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          className={`h-3 w-3 shrink-0 transition-transform ${open ? "rotate-180" : ""}`}
          aria-hidden
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="m6 9 6 6 6-6" />
        </svg>
      </button>

      {open && (
        <ul
          role="listbox"
          className="absolute right-0 top-full z-40 mt-1 min-w-[120px] overflow-hidden rounded-sm border border-line bg-white text-ink shadow-lg"
        >
          {OPTIONS.map((option) => (
            <li key={option.value}>
              <button
                type="button"
                role="option"
                aria-selected={currency === option.value}
                onClick={() => handleSelect(option.value)}
                className={`flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm hover:bg-line/50 ${
                  currency === option.value ? "font-semibold text-ink" : "text-accent-2"
                }`}
              >
                <span>{option.name}</span>
                <span>{option.symbol}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
