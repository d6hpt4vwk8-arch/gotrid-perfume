import { NextResponse } from "next/server";
import { getFeedProducts } from "@/lib/feeds/get-feed-products";
import { isPaidAdsEligible } from "@/lib/feeds/paid-ads-eligibility";
import { cdata, escapeXml, isValidEan } from "@/lib/feeds/xml";
import { SITE_URL } from "@/lib/site";
import { getSettings } from "@/lib/settings.server";

// Rendered per-request rather than ISR-cached — see feeds/heureka.xml/route.ts
// for why (oversized-ISR-page build failure past ~15k products).
export const dynamic = "force-dynamic";

// Only what checkout actually offers today — advertising a carrier we don't
// serve is what gets a shop flagged (and Heureka/Zboží can block for it), so
// retired methods (PPL/DPD/Balíkovna) are deliberately NOT listed even
// though the enum still has them for historical orders. Values are our own
// ShippingMethod enum names so deliveryType sent to sendZboziConversion
// (src/lib/analytics/zbozi-conversion.ts, set to order.shippingMethod
// verbatim) matches a declared DELIVERY_ID for every order still being
// placed. Note Zboží.cz currently takes delivery prices from its own admin
// panel (Centrum prodejce → Doprava → "Nastavení cen: Administrační
// rozhraní") rather than these tags — switching that toggle to "Feed" is
// what makes these numbers authoritative and keeps them from going stale.
const DELIVERY_IDS = ["ZASILKOVNA", "GLS", "GLS_MISTO", "OSOBNI_ODBER"] as const;

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
    <DELIVERY_DATE>${p.stock > 0 ? "1" : "7"}</DELIVERY_DATE>
${p.params
  .map(
    (param) =>
      `    <PARAM><PARAM_NAME>${escapeXml(param.name)}</PARAM_NAME><VAL>${escapeXml(param.value)}</VAL></PARAM>`,
  )
  .join("\n")}
${DELIVERY_IDS.map(
  (id) => `    <DELIVERY>
      <DELIVERY_ID>${id}</DELIVERY_ID>
      <DELIVERY_PRICE>${settings.shippingPrices[id].toFixed(2)}</DELIVERY_PRICE>
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
