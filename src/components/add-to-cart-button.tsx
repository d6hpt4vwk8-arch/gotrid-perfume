"use client";

import { useState } from "react";
import Image from "next/image";
import { useCart } from "@/lib/cart-context";
import { useConsent } from "@/lib/consent-context";
import { trackAddToCart } from "@/lib/analytics/client-events";
import { getPurchaseWarning, type PurchaseWarningReason } from "@/lib/feeds/condition-flagged";

export interface AddToCartProduct {
  productId: string;
  code: string;
  slug: string;
  name: string;
  price: number;
  image: string | null;
  stock: number;
  isDefective: boolean;
}

// Copy agreed with the owner (2026-09-22): lead with what the product
// actually is, not with "warning" — a tester is genuinely full/unused, so
// it gets a value-framed message, a reassuring (green/ok) badge and a plain
// confirm button, while only genuinely opened/damaged goods get the more
// cautious amber badge and an explicit "Rozumím" acknowledgment. Vintage
// stock deliberately has no popup at all — it's sealed/unused, nothing to
// disclose here (still kept out of ad feeds by isConditionFlagged, that's
// unrelated).
const WARNING_COPY: Record<
  PurchaseWarningReason,
  { message: string; confirmLabel: string; badgeClass: string; icon: "check" | "info" }
> = {
  tester: {
    message:
      "je tester — 100% originál, stejné složení i objem jako běžné balení, jen bez klasické krabičky. Proto je cena výhodnější.",
    confirmLabel: "Přidat do košíku",
    badgeClass: "bg-ok/10 text-ok",
    icon: "check",
  },
  opened: {
    message:
      "má otevřené nebo mírně poškozené balení, obsah je ale v pořádku — proto nabízíme nižší cenu. Přesný stav najdete v popisu a na fotografiích.",
    confirmLabel: "Rozumím, přidat do košíku",
    badgeClass: "bg-amber-600/10 text-amber-700",
    icon: "info",
  },
};

function BadgeIcon({ icon }: { icon: "check" | "info" }) {
  if (icon === "check") {
    return (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <circle cx="12" cy="12" r="10" fill="currentColor" fillOpacity="0.15" />
        <path
          d="M7.5 12.5l3 3 6-6.5"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
      </svg>
    );
  }
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="10" fill="currentColor" fillOpacity="0.15" />
      <rect x="11" y="10.5" width="2" height="6" rx="1" fill="currentColor" />
      <rect x="11" y="6.5" width="2" height="2" rx="1" fill="currentColor" />
    </svg>
  );
}

export function AddToCartButton({
  product,
  className,
}: {
  product: AddToCartProduct;
  className?: string;
}) {
  const { addItem } = useCart();
  const { consent } = useConsent();
  const [added, setAdded] = useState(false);
  const [showWarning, setShowWarning] = useState(false);

  const outOfStock = product.stock <= 0;
  const warningReason = getPurchaseWarning(product.name, product.isDefective);

  const commit = () => {
    addItem(product);
    if (consent?.marketing) {
      trackAddToCart({
        code: product.code,
        name: product.name,
        price: product.price,
        qty: 1,
      });
    }
    setAdded(true);
    setTimeout(() => setAdded(false), 1500);
  };

  return (
    <>
      <button
        type="button"
        disabled={outOfStock}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          if (warningReason) {
            setShowWarning(true);
            return;
          }
          commit();
        }}
        className={
          className ??
          "w-full rounded-sm bg-ink px-4 py-3 text-sm font-semibold text-white transition hover:bg-accent disabled:cursor-not-allowed disabled:bg-line disabled:text-accent-2"
        }
      >
        {outOfStock ? "Vyprodáno" : added ? "Přidáno ✓" : "Přidat do košíku"}
      </button>

      {showWarning && warningReason && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-ink/60 p-4 animate-[overlay-in_0.15s_ease-out]"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setShowWarning(false);
          }}
        >
          <div
            className="flex w-full max-w-sm flex-col gap-5 rounded-sm bg-white p-6 shadow-2xl animate-[modal-in_0.2s_ease-out]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <div
                className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${WARNING_COPY[warningReason].badgeClass}`}
              >
                <BadgeIcon icon={WARNING_COPY[warningReason].icon} />
              </div>
              <button
                type="button"
                aria-label="Zavřít"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setShowWarning(false);
                }}
                className="-mr-1 -mt-1 flex h-7 w-7 items-center justify-center rounded-full text-accent-2 hover:bg-line/50 hover:text-ink"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path
                    d="M5 5l14 14M19 5 5 19"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                  />
                </svg>
              </button>
            </div>

            <div className="flex flex-col gap-1.5">
              <h2 className="text-base font-bold text-ink">Dobré vědět, než přidáte do košíku</h2>
            </div>

            <div className="flex items-center gap-3 rounded-sm border border-line bg-line/20 p-3">
              {product.image && (
                <Image
                  src={product.image}
                  alt=""
                  width={48}
                  height={48}
                  className="h-12 w-12 shrink-0 rounded-sm object-cover"
                />
              )}
              <p className="text-sm leading-relaxed text-accent-2">
                <strong className="text-ink">{product.name}</strong>{" "}
                {WARNING_COPY[warningReason].message}
              </p>
            </div>

            <div className="flex flex-col gap-2">
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setShowWarning(false);
                  commit();
                }}
                className="w-full rounded-sm bg-ink px-4 py-3 text-sm font-semibold text-white transition hover:bg-accent"
              >
                {WARNING_COPY[warningReason].confirmLabel}
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setShowWarning(false);
                }}
                className="text-center text-xs text-accent-2 underline hover:text-ink"
              >
                Zrušit
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
