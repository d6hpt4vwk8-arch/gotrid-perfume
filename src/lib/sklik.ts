// Shared helpers for Seznam Sklik retargeting + conversion measurement
// (napoveda.sklik.cz/en/tracking-scripts/retargeting-code/,
// napoveda.sklik.cz/merici-skripty/konverzni-kod/). Both the site-wide
// retargeting tag (src/components/sklik-pixel.tsx) and the order-page
// conversion tag (src/components/sklik-conversion.tsx) load the same
// rc.js script, so loading it is deduplicated here.

declare global {
  interface Window {
    rc?: {
      retargetingHit: (conf: { rtgId: number; consent: 0 | 1 }) => void;
      conversionHit: (conf: {
        id?: number;
        zboziId?: number;
        zboziType?: "standard" | "limited" | "sandbox";
        value?: number;
        orderId?: string;
        consent: 0 | 1;
      }) => void;
    };
  }
}

let scriptLoading: Promise<void> | null = null;

export function loadSklikScript(): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  if (window.rc) return Promise.resolve();
  if (scriptLoading) return scriptLoading;

  scriptLoading = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://c.seznam.cz/js/rc.js";
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Failed to load Sklik rc.js"));
    document.head.appendChild(script);
  });
  return scriptLoading;
}

// Sklik wants the conversion value ex-shipping and ex-VAT ("hodnota
// objednávky bez částky za dopravu a platbu a bez DPH" per napoveda.sklik.cz)
// — order.itemsTotal is already shipping-excluded but VAT-inclusive (the
// customer-facing price), so this also strips a blended VAT rate weighted
// by each item's own vatRate (almost always a uniform 21% in practice, but
// computed properly in case an order ever mixes rates).
export function calculateSklikConversionValue(
  items: { unitPrice: number; qty: number; vatRate: number }[],
  discountAmount: number,
): number {
  const vatInclusiveSubtotal = items.reduce((sum, item) => sum + item.unitPrice * item.qty, 0);
  if (vatInclusiveSubtotal <= 0) return 0;

  const weightedVatRate =
    items.reduce((sum, item) => sum + item.unitPrice * item.qty * item.vatRate, 0) / vatInclusiveSubtotal;

  const netOfDiscount = Math.max(0, vatInclusiveSubtotal - discountAmount);
  return Math.round((netOfDiscount / (1 + weightedVatRate / 100)) * 100) / 100;
}
