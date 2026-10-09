// Small trust pills for cosmetics (owner 2026-10-09, modelled on Kosco / Cosibella /
// K-Sisters): Bestseller = sold at least once (for a young shop even one sale is a
// signal), Vegan / Cruelty-free only where the brand or retailer states it about
// the product itself (see Product.isVegan / isCrueltyFree).
export const BESTSELLER_MIN_SALES = 1;

export function isBestseller(salesCount?: number | null): boolean {
  return (salesCount ?? 0) >= BESTSELLER_MIN_SALES;
}

export function BestsellerPill({ className = "" }: { className?: string }) {
  return (
    <span className={`rounded-sm bg-amber-200 px-1.5 py-1 text-xs font-bold text-amber-950 ${className}`}>
      Bestseller
    </span>
  );
}

/** Thin line icons in the site's quiet style (no emoji). */
function LeafIcon() {
  return (
    <svg viewBox="0 0 16 16" aria-hidden className="h-3 w-3 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 13c0-6 3.5-9.5 10-10 0 6.5-3.5 10-10 10Z" />
      <path d="M3 13c2.5-3 4.5-5 7-6.5" />
    </svg>
  );
}

function HeartIcon() {
  return (
    <svg viewBox="0 0 16 16" aria-hidden className="h-3 w-3 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round">
      <path d="M8 13.5S2.5 10 2.5 6.2A2.9 2.9 0 0 1 8 4.9a2.9 2.9 0 0 1 5.5 1.3C13.5 10 8 13.5 8 13.5Z" />
    </svg>
  );
}

export function EthicsPills({
  isVegan,
  isCrueltyFree,
  className = "",
}: {
  isVegan?: boolean;
  isCrueltyFree?: boolean;
  className?: string;
}) {
  if (!isVegan && !isCrueltyFree) return null;
  // Same voice as the brand label above a product name: tiny, uppercase, tracked,
  // square corners, hairline border — in the site's green for "good for you / nature".
  const pill =
    "inline-flex items-center gap-1 rounded-sm border border-ok/40 bg-white/95 px-1.5 py-0.5 text-[10px] font-medium tracking-wide text-ok uppercase";
  return (
    <div className={`flex flex-wrap items-center gap-1 ${className}`}>
      {isVegan && (
        <span className={pill}>
          <LeafIcon />
          Vegan
        </span>
      )}
      {isCrueltyFree && (
        <span className={pill} title="Cruelty-free: produkt ani jeho složky nebyly testovány na zvířatech">
          <HeartIcon />
          Cruelty-free
        </span>
      )}
    </div>
  );
}
