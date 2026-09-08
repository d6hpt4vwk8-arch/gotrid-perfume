import { NextResponse } from "next/server";
import { getFeedProducts } from "@/lib/feeds/get-feed-products";
import { isPaidAdsEligible } from "@/lib/feeds/paid-ads-eligibility";
import { cdata, escapeXml, isValidEan } from "@/lib/feeds/xml";
import { SITE_URL } from "@/lib/site";
import { getSettings } from "@/lib/settings.server";
import type { ShippingMethod } from "@prisma/client";

// Rendered per-request rather than ISR-cached — see feeds/heureka.xml/route.ts
// for why (oversized-ISR-page build failure past ~15k products).
export const dynamic = "force-dynamic";

// Only what checkout actually offers today — advertising a carrier we don't
// serve is what gets a shop flagged (and Heureka/Zboží can block for it), so
// retired methods (PPL/DPD/Balíkovna) are deliberately NOT listed even
// though the enum still has them for historical orders. `method` keys the
// price lookup into our own Settings/ShippingMethod naming; `deliveryId` is
// the separate, fixed vocabulary Zboží's feed validator actually accepts
// (napoveda.sklik.cz/reklamy/xml-feed/specifikace/#DELIVERY) — confirmed via
// Centrum prodejce → Nabídky → any offer's "Data nabídky" on 2026-09-08,
// which flagged every single one of our ~3,258 offers with "Neplatný
// dopravce: 'GLS_MISTO'" and "'OSOBNI_ODBER'": those two are our internal
// ShippingMethod names, not real Zboží delivery codes, so both were being
// silently dropped feed-wide. The real codes are GLS_PARCELSHOP (matches
// Heureka's own vocabulary for the same GLS pickup-point network) and
// VLASTNI_VYDEJNI_MISTA ("own pickup points" — Zboží's term for a merchant's
// single walk-in address, i.e. our OSOBNI_ODBER). Note Zboží.cz currently
// takes delivery prices from its own admin panel (Centrum prodejce →
// Doprava → "Nastavení cen: Administrační rozhraní") rather than these tags
// — switching that toggle to "Feed" is what makes these numbers
// authoritative and keeps them from going stale.
const DELIVERY_METHODS: { method: ShippingMethod; deliveryId: string }[] = [
  { method: "ZASILKOVNA", deliveryId: "ZASILKOVNA" },
  { method: "GLS", deliveryId: "GLS" },
  { method: "GLS_MISTO", deliveryId: "GLS_PARCELSHOP" },
  { method: "OSOBNI_ODBER", deliveryId: "VLASTNI_VYDEJNI_MISTA" },
];

export async function GET() {
  const settings = await getSettings();

  const allProducts = await getFeedProducts();
  // Sklik's Nákupy (Shopping) campaigns ingest this same Zboží-format feed —
  // see paid-ads-eligibility.ts for why only Tamda/Korean-cosmetics/Arabic
  // fragrances are advertised here.
  const products = allProducts.filter((p) => p.stock > 0 && isPaidAdsEligible(p.code, p.brandName));

  const items = products
    .map((p) => {
      const url = `${SITE_URL}/produkt/${p.slug}`;
      const image = p.images[0] ? `${SITE_URL}${p.images[0]}` : null;
      // DELIVERY_DATE is days from order to dispatch, not total delivery
      // time — Zboží buckets 0 as "skladem"/"ihned" and 1-3 as "do 3 dnů".
      // An in-stock item (dispatched same/next business day, per the
      // product page's own "Ihned k odeslání" copy) must be 0, not 1, or
      // every listing undersells itself with a 3-day estimate.
      const deliveryDate = p.stock > 0 ? "0" : "7";

      return `  <SHOPITEM>
    <ITEM_ID>${escapeXml(p.code)}</ITEM_ID>
    <PRODUCTNAME>${escapeXml(p.name)}</PRODUCTNAME>
    <DESCRIPTION>${cdata(p.description)}</DESCRIPTION>
    <URL>${escapeXml(url)}</URL>
    ${image ? `<IMGURL>${escapeXml(image)}</IMGURL>` : ""}
    <PRICE_VAT>${p.price.toFixed(2)}</PRICE_VAT>
    ${p.brandName ? `<MANUFACTURER>${escapeXml(p.brandName)}</MANUFACTURER>` : ""}
    ${p.ean && isValidEan(p.ean) ? `<EAN>${escapeXml(p.ean)}</EAN>` : ""}
    ${p.categoryBreadcrumb ? `<CATEGORYTEXT>${escapeXml(p.categoryBreadcrumb)}</CATEGORYTEXT>` : ""}
    <DELIVERY_DATE>${deliveryDate}</DELIVERY_DATE>
${p.params
  .map(
    (param) =>
      `    <PARAM><PARAM_NAME>${escapeXml(param.name)}</PARAM_NAME><VAL>${escapeXml(param.value)}</VAL></PARAM>`,
  )
  .join("\n")}
${DELIVERY_METHODS.map(
  ({ method, deliveryId }) => `    <DELIVERY>
      <DELIVERY_ID>${deliveryId}</DELIVERY_ID>
      <DELIVERY_PRICE>${settings.shippingPrices[method].toFixed(2)}</DELIVERY_PRICE>
    </DELIVERY>`,
).join("\n")}
  </SHOPITEM>`;
    })
    .join("\n");

  const xml = `<?xml version="1.0" encoding="utf-8"?>
<SHOP xmlns="http://www.zbozi.cz/ns/offer/1.0">
${items}
</SHOP>`;

  return new NextResponse(xml, {
    headers: { "Content-Type": "application/xml; charset=utf-8" },
  });
}
