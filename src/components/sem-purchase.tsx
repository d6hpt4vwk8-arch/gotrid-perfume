"use client";

import { useEffect } from "react";
import { useConsent } from "@/lib/consent-context";
import { SEM_ID, loadSemScript, semTrack, semUpdateConsent } from "@/lib/sem";

export interface SemPurchaseData {
  orderId: string;
  /** Goods ex VAT, ex shipping, after discount — the same value the old Sklik conversion code reported. */
  value: number;
  /** VAT contained in the goods total. */
  valueTax: number;
  /** Shipping incl. VAT. */
  deliveryPrice: number;
  /** Cash-on-delivery surcharge incl. VAT (0 when none). */
  otherCosts: number;
  paymentType: "karta" | "prevod" | "dobirka";
  contents: { id: string; content_name: string; quantity: number; unit_price: number }[];
}

const sent = new Set<string>();

/**
 * Seznam Event Measurement Purchase event (napoveda.sklik.cz → SEM → Event reference), rendered only on the
 * order confirmation page next to SklikConversion. Fires once per order and only after marketing consent;
 * `order_id` is also Seznam's own dedup key if the page is reloaded. review_email is deliberately not sent
 * (it needs a consent-based survey opt-in we do not collect for Zboží reviews).
 */
export function SemPurchase({ data }: { data: SemPurchaseData }) {
  const { consent } = useConsent();
  const marketing = Boolean(consent?.marketing);
  const analytics = Boolean(consent?.analytics);

  useEffect(() => {
    if (!SEM_ID || !marketing || sent.has(data.orderId)) return;
    const key = `sem-purchase-${data.orderId}`;
    try {
      if (window.sessionStorage.getItem(key)) return;
    } catch {
      // sessionStorage can be blocked — the module-level Set still guards this page view
    }
    sent.add(data.orderId);
    loadSemScript()
      .then(() => {
        semUpdateConsent({ marketing, analytics });
        semTrack("Purchase", {
          order_id: data.orderId,
          currency: "CZK",
          value: data.value,
          value_tax: data.valueTax,
          delivery_price: data.deliveryPrice,
          ...(data.otherCosts ? { other_costs: data.otherCosts } : {}),
          payment_type: data.paymentType,
          content_type: "product",
          contents: data.contents,
        });
        try {
          window.sessionStorage.setItem(key, "1");
        } catch {
          // ignore
        }
      })
      .catch(() => sent.delete(data.orderId));
  }, [marketing, analytics, data]);

  return null;
}
