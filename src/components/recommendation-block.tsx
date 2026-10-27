"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { useIsSk } from "@/i18n/use-tr";

export type RecommendationBlockName = "pdp_related" | "pdp_fbt" | "pdp_complement" | "pdp_line" | "cart_complete";

type Clarity = (...args: unknown[]) => void;

function send(block: RecommendationBlockName, event: "view" | "click" | "add", locale: "sk" | "cs", productId?: string, sourceProductId?: string) {
  try {
    // Microsoft Clarity custom event — present only after analytics consent (same gate as the tag itself).
    (window as unknown as { clarity?: Clarity }).clarity?.("event", `rec_${block}_${event}`);
    const body = JSON.stringify({ block, event, productId, sourceProductId, locale });
    // sendBeacon survives the navigation that a click on a product link causes.
    if (!(navigator.sendBeacon && navigator.sendBeacon("/api/rec-events", new Blob([body], { type: "application/json" })))) {
      void fetch("/api/rec-events", { method: "POST", headers: { "Content-Type": "application/json" }, body, keepalive: true });
    }
  } catch {
    // best-effort analytics
  }
}

/**
 * Wraps one cross-sell grid and counts how it performs: seen (once per page view),
 * a product opened, a product added to the cart. Each product inside must sit in an
 * element with `data-rec-product="<productId>"`; the add-to-cart button is recognised
 * by its `data-add-to-cart` attribute. Counts are anonymous (see RecommendationEvent).
 */
export function RecommendationBlock({
  block,
  sourceProductId,
  children,
}: {
  block: RecommendationBlockName;
  sourceProductId?: string;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const isSk = useIsSk();
  const locale = isSk ? "sk" : "cs";

  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          send(block, "view", locale, undefined, sourceProductId);
          observer.disconnect();
        }
      },
      { threshold: 0.3 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [block, locale, sourceProductId]);

  return (
    <div
      ref={ref}
      // Capture phase: the add-to-cart button stops propagation, a bubbling handler would never see it.
      onClickCapture={(e) => {
        const target = e.target as HTMLElement;
        const card = target.closest<HTMLElement>("[data-rec-product]");
        const productId = card?.dataset.recProduct;
        if (!productId) return;
        if (target.closest("[data-add-to-cart]")) send(block, "add", locale, productId, sourceProductId);
        else if (target.closest("button")) return; // wishlist heart etc. — not an interest in the product
        else if (target.closest("a")) send(block, "click", locale, productId, sourceProductId);
      }}
    >
      {children}
    </div>
  );
}
