"use client";

import { useEffect, useState } from "react";

const WIDGET_URL = "https://ps-maps.gls-czech.com/?find=1&ctrcode=CZ&lng=cs";

export interface GlsPickupPoint {
  id: string;
  name: string;
  street: string;
  city: string;
  zip: string;
}

/**
 * GLS's own ParcelShop/Locker/Box map — official iframe integration per
 * "How to implement ShopDeliveryService" (GLS CZ, ver. 28.7.2026): the
 * widget posts window.parent.postMessage({event_id:'ps_data_handover',
 * parcelshop:{detail:{...}}}) once a point is picked. Unlike Zásilkovna,
 * GLS's PSD service can't resolve a point's address from its id alone at
 * label time, so the full address is captured here and sent along with the
 * order (see checkout-schema.ts / gls.ts).
 */
export function GlsPickupPointPicker({
  selectedPointName,
  onSelect,
}: {
  selectedPointName: string | null;
  onSelect: (point: GlsPickupPoint) => void;
}) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    function handleMessage(event: MessageEvent) {
      if (event.origin !== "https://ps-maps.gls-czech.com") return;
      const data = event.data as { event_id?: string; parcelshop?: { detail?: Record<string, string> } };
      if (data?.event_id === "ps_data_handover" && data.parcelshop?.detail) {
        const point = data.parcelshop.detail;
        onSelect({
          id: point.pclshopid ?? "",
          name: point.name ?? "",
          street: point.address ?? "",
          city: point.city ?? "",
          zip: point.zipcode ?? "",
        });
        setOpen(false);
      } else if (data?.event_id === "closeWidget") {
        setOpen(false);
      }
    }
    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [open, onSelect]);

  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-sm border border-line px-4 py-2 text-sm font-medium text-ink hover:border-accent hover:text-accent"
      >
        {selectedPointName ? "Změnit výdejní místo GLS" : "Vybrat výdejní místo GLS"}
      </button>
      {selectedPointName && <p className="text-sm text-ink/80">Vybráno: {selectedPointName}</p>}

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="relative flex h-[85vh] w-full max-w-3xl flex-col overflow-hidden rounded-sm bg-white shadow-2xl">
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Zavřít"
              className="absolute top-2 right-2 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-black/40 text-white hover:bg-black/60"
            >
              ✕
            </button>
            <iframe src={WIDGET_URL} title="Výdejní místa GLS" className="h-full w-full border-0" />
          </div>
        </div>
      )}
    </div>
  );
}
