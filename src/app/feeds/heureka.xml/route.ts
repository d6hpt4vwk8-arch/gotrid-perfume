import { NextResponse } from "next/server";
import { getFeedProducts } from "@/lib/feeds/get-feed-products";
import { cdata, escapeXml, feedDescription } from "@/lib/feeds/xml";
import { SITE_URL } from "@/lib/site";
import { getSettings } from "@/lib/settings.server";

// Delivery codes per Heureka's XML feed manual (sluzby.heureka.cz/napoveda/xml-feed/).
// TZ §7.1: verify these against the current official list before the feed
// goes live in Heureka Business Center — Heureka updates delivery codes
// occasionally and a stale code would just be silently ignored by them.
// Prices are owner-editable in /admin/nastaveni, not hardcoded.
export const revalidate = 3600;

export async function GET() {
  const settings = await getSettings();
  const DELIVERY_METHODS = [
    { id: "ZASILKOVNA", price: settings.shippingPrices.ZASILKOVNA },
    { id: "PPL", price: settings.shippingPrices.PPL },
    { id: "DPD", price: settings.shippingPrices.DPD },
  ];

  const allProducts = await getFeedProducts();
  // Heureka's format has no explicit "in stock" flag — out-of-stock items are
  // conventionally left out of the feed entirely rather than listed unavailable.
  const products = allProducts.filter((p) => p.stock > 0);

  const items = products
    .map((p) => {
      const url = `${SITE_URL}/produkt/${p.slug}`;
      const images = p.images.map((img) => `${SITE_URL}${img}`);
      const [mainImage, ...altImages] = images;

      return `  <SHOPITEM>
    <ITEM_ID>${escapeXml(p.code)}</ITEM_ID>
    <PRODUCTNAME>${escapeXml(p.name)}</PRODUCTNAME>
    <DESCRIPTION>${cdata(feedDescription(p))}</DESCRIPTION>
    <URL>${escapeXml(url)}</URL>
    ${mainImage ? `<IMGURL>${escapeXml(mainImage)}</IMGURL>` : ""}
${altImages.map((img) => `    <IMGURL_ALTERNATIVE>${escapeXml(img)}</IMGURL_ALTERNATIVE>`).join("\n")}
    <PRICE_VAT>${p.price.toFixed(2)}</PRICE_VAT>
    ${p.compareAtPrice ? `<PRICE_BEFORE>${p.compareAtPrice.toFixed(2)}</PRICE_BEFORE>` : ""}
    ${p.brandName ? `<MANUFACTURER>${escapeXml(p.brandName)}</MANUFACTURER>` : ""}
    ${p.ean ? `<EAN>${escapeXml(p.ean)}</EAN>` : ""}
    ${p.categoryBreadcrumb ? `<CATEGORYTEXT>${escapeXml(p.categoryBreadcrumb)}</CATEGORYTEXT>` : ""}
    <DELIVERY_DATE>${p.stock > 0 ? "1" : "7"}</DELIVERY_DATE>
${DELIVERY_METHODS.map(
  (d) => `    <DELIVERY>
      <DELIVERY_ID>${d.id}</DELIVERY_ID>
      <DELIVERY_PRICE>${d.price.toFixed(2)}</DELIVERY_PRICE>
      <DELIVERY_PRICE_COD>${d.price.toFixed(2)}</DELIVERY_PRICE_COD>
    </DELIVERY>`,
).join("\n")}
    ${p.brandName ? `<PARAM><PARAM_NAME>Značka</PARAM_NAME><VAL>${escapeXml(p.brandName)}</VAL></PARAM>` : ""}
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
