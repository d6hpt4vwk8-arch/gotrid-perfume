import type { ShippingMethod } from "@prisma/client";

// What the customer sees as "Sledovací číslo" and where it opens. Zásilkovna's number is the Z-prefixed barcode
// printed on the label and quoted in its own SMS ("Z 229 6964 693" is Z + the 10-digit packet id); Balíkovna's is
// the Czech Post parcel code; GLS's is the parcel number. All three URLs verified live against real parcels.
export function packetaTrackingNumber(packetId: string): string {
  return `Z${packetId}`;
}

export function trackingUrl(shippingMethod: ShippingMethod, trackingNumber: string): string | null {
  const n = encodeURIComponent(trackingNumber);
  switch (shippingMethod) {
    case "ZASILKOVNA":
    case "ZASILKOVNA_HD":
      return `https://tracking.packeta.com/cs/${n}`;
    case "GLS":
    case "GLS_MISTO":
      return `https://gls-group.com/CZ/cs/sledovani-zasilek?match=${n}`;
    case "BALIKOVNA":
      return `https://www.postaonline.cz/trackandtrace/-/zasilka/cislo?parcelNumbers=${n}`;
    default:
      return null;
  }
}
