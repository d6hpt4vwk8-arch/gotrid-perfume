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
  const pill = "inline-flex items-center gap-1 rounded-full bg-white/95 px-2 py-0.5 text-[11px] font-medium text-ink shadow-sm ring-1 ring-line";
  return (
    <div className={`flex flex-wrap items-center gap-1.5 ${className}`}>
      {isVegan && (
        <span className={pill}>
          <span aria-hidden>🌱</span>Vegan
        </span>
      )}
      {isCrueltyFree && (
        <span className={pill}>
          <span aria-hidden>🐰</span>Cruelty-free
        </span>
      )}
    </div>
  );
}
