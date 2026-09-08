import { NextResponse } from "next/server";
import { getFeedProducts } from "@/lib/feeds/get-feed-products";
import { isPaidAdsEligible } from "@/lib/feeds/paid-ads-eligibility";
import { cdata, escapeXml, isValidEan } from "@/lib/feeds/xml";
import { SITE_URL } from "@/lib/site";
import { getSettings } from "@/lib/settings.server";

// Delivery codes per Heureka's XML feed manual (sluzby.heureka.cz/napoveda/xml-feed/).
// TZ §7.1: verify these against the current official list before the feed
// goes live in Heureka Business Center — Heureka updates delivery codes
// occasionally and a stale code would just be silently ignored by them.
// Prices are owner-editable in /admin/nastaveni, not hardcoded.
// Rendered per-request rather than ISR-cached: past ~15k products the full
// feed exceeds Vercel's 19.07 MB pre-rendered-response cap and fails the
// build (FALLBACK_BODY_TOO_LARGE) — first hit by the perfumes-wholesale.eu
// import (2026-08-23), which pushed the catalog past that size.
export const dynamic = "force-dynamic";

export async function GET() {
  const settings = await getSettings();
  // Must match what checkout actually offers — Heureka blocks shops for
  // untruthful delivery info ("V případě nepravdivě zadaných údajů bude
  // obchod blokován", sluzby.heureka.cz → Nastavení → Ceny dopravy), and
  // until 2026-09-08 this still advertised PPL/DPD/Balíkovna long after all
  // three were retired while omitting GLS entirely — including the cheapest
  // option we have, so Heureka showed our delivery as pricier than it is.
  // IDs come from Heureka's own carrier vocabulary (not our enum names):
  // ZASILKOVNA = pickup points, GLS = courier to address, GLS_PARCELSHOP =
  // GLS pickup points/boxes.
  const DELIVERY_METHODS = [
    { id: "GLS_PARCELSHOP", price: settings.shippingPrices.GLS_MISTO },
    { id: "ZASILKOVNA", price: settings.shippingPrices.ZASILKOVNA },
    { id: "GLS", price: settings.shippingPrices.GLS },
  ];

  const allProducts = await getFeedProducts();
  // Heureka's format has no explicit "in stock" flag — out-of-stock items are
  // conventionally left out of the feed entirely rather than listed unavailable.
  // excludeFromHeureka additionally drops items priced well above the
  // cheapest competitor there — paying per click for a listing that can't
  // win on price just funds clicks that were never going to convert.
  const products = allProducts.filter(
    (p) => p.stock > 0 && !p.excludeFromHeureka && isPaidAdsEligible(p.code, p.brandName),
  );

  const items = products
    .map((p) => {
      const url = `${SITE_URL}/produkt/${p.slug}`;
      const images = p.images.map((img) => `${SITE_URL}${img}`);
      const [mainImage, ...altImages] = images;
      // Days from order to dispatch, not total delivery time — Heureka
      // buckets 0 as "skladem" and 1-3 as "do 3 dnů" (sluzby.heureka.cz/
      // napoveda/xml-feed/#DELIVERY_DATE). An in-stock item (dispatched
      // same/next business day, per the product page's own "Ihned k
      // odeslání" copy) must be 0, not 1, or every listing undersells
      // itself with a 3-day estimate.
      const deliveryDate = p.stock > 0 ? "0" : "7";

      return `  <SHOPITEM>
    <ITEM_ID>${escapeXml(p.code)}</ITEM_ID>
    <PRODUCTNAME>${escapeXml(p.name)}</PRODUCTNAME>
    <DESCRIPTION>${cdata(p.description)}</DESCRIPTION>
    <URL>${escapeXml(url)}</URL>
    ${mainImage ? `<IMGURL>${escapeXml(mainImage)}</IMGURL>` : ""}
${altImages.map((img) => `    <IMGURL_ALTERNATIVE>${escapeXml(img)}</IMGURL_ALTERNATIVE>`).join("\n")}
    <PRICE_VAT>${p.price.toFixed(2)}</PRICE_VAT>
    ${p.compareAtPrice ? `<PRICE_BEFORE>${p.compareAtPrice.toFixed(2)}</PRICE_BEFORE>` : ""}
    ${p.brandName ? `<MANUFACTURER>${escapeXml(p.brandName)}</MANUFACTURER>` : ""}
    ${p.ean && isValidEan(p.ean) ? `<EAN>${escapeXml(p.ean)}</EAN>` : ""}
    ${p.categoryBreadcrumb ? `<CATEGORYTEXT>${escapeXml(p.categoryBreadcrumb)}</CATEGORYTEXT>` : ""}
    <DELIVERY_DATE>${deliveryDate}</DELIVERY_DATE>
${DELIVERY_METHODS.map(
  (d) => `    <DELIVERY>
      <DELIVERY_ID>${d.id}</DELIVERY_ID>
      <DELIVERY_PRICE>${d.price.toFixed(2)}</DELIVERY_PRICE>
      <DELIVERY_PRICE_COD>${(d.price + settings.codSurcharge).toFixed(2)}</DELIVERY_PRICE_COD>
    </DELIVERY>`,
).join("\n")}
${p.params
  .map(
    (param) =>
      `    <PARAM><PARAM_NAME>${escapeXml(param.name)}</PARAM_NAME><VAL>${escapeXml(param.value)}</VAL></PARAM>`,
  )
  .join("\n")}
  </SHOPITEM>`;
    })
    .join("\n");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<SHOP>
${items}
</SHOP>`;

  return new NextResponse(xml, {
    headers: { "Content-Type": "application/xml; charset=utf-8" },
  });
}
