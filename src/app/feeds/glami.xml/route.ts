import { NextResponse } from "next/server";
import { getFeedProducts } from "@/lib/feeds/get-feed-products";
import { isPaidAdsEligible } from "@/lib/feeds/paid-ads-eligibility";
import { cdata, escapeXml, isValidEan } from "@/lib/feeds/xml";
import { SITE_URL } from "@/lib/site";
import { getSettings } from "@/lib/settings.server";

// GLAMI.cz is pay-per-click, same as Heureka/Zboží — see paid-ads-eligibility.ts
// for why only Tamda/Korean-cosmetics/Arabic-fragrance/original-stock items
// are advertised here (designer perfumes can't win on price against
// distributor-volume retailers).
export const dynamic = "force-dynamic";

// Same carrier vocabulary as Heureka's feed (see heureka.xml/route.ts) —
// GLAMI's own DELIVERY_ID list (glami.cz/info/feed/) doesn't document a
// fixed set of accepted values the way Zboží's does, so this reuses
// Heureka's known-good IDs rather than guessing new ones.
const DELIVERY_METHODS = [
  { id: "GLS_PARCELSHOP", price: 0 as number },
  { id: "ZASILKOVNA", price: 0 as number },
  { id: "GLS", price: 0 as number },
];

export async function GET() {
  const settings = await getSettings();
  DELIVERY_METHODS[0].price = settings.shippingPrices.GLS_MISTO;
  DELIVERY_METHODS[1].price = settings.shippingPrices.ZASILKOVNA;
  DELIVERY_METHODS[2].price = settings.shippingPrices.GLS;

  const allProducts = await getFeedProducts();
  const products = allProducts.filter(
    (p) => p.stock > 0 && isPaidAdsEligible(p.code, p.brandName),
  );

  const items = products
    .map((p) => {
      const url = `${SITE_URL}/produkt/${p.slug}`;
      const images = p.images.map((img) => `${SITE_URL}${img}`);
      const [mainImage, ...altImages] = images;
      const deliveryDate = p.stock > 0 ? "0" : "7";

      // GLAMI requires a size system + value on every item except glasses,
      // scarves and handbags (glami.cz/info/feed/) — perfumes aren't in that
      // exemption list, and their own accepted-sizes table lists "100 ml" as
      // a valid accessory size, so the volume PARAM already built for
      // Heureka/Zboží (see get-feed-products.ts's buildParams) doubles here
      // as the required velikost/size_system pair. SIZE_SYSTEM "INT" per
      // their doc's generic/non-EU-UK-US-IT-RU bucket — unverified against a
      // live GLAMI validator, revisit if their feed checker flags it.
      const volumeParam = p.params.find((param) => param.name === "Objem");
      const sizeParams = volumeParam
        ? [
            { name: "velikost", value: volumeParam.value },
            { name: "size_system", value: "INT" },
          ]
        : [];

      return `  <SHOPITEM>
    <ITEM_ID>${escapeXml(p.code)}</ITEM_ID>
    <ITEMGROUP_ID>${escapeXml(p.code)}</ITEMGROUP_ID>
    <PRODUCTNAME>${escapeXml(p.name)}</PRODUCTNAME>
    <DESCRIPTION>${cdata(p.description)}</DESCRIPTION>
    <URL>${escapeXml(url)}</URL>
    <URL_SIZE>${escapeXml(url)}</URL_SIZE>
    ${mainImage ? `<IMGURL>${escapeXml(mainImage)}</IMGURL>` : ""}
${altImages.map((img) => `    <IMGURL_ALTERNATIVE>${escapeXml(img)}</IMGURL_ALTERNATIVE>`).join("\n")}
    <PRICE_VAT>${p.price.toFixed(2)}</PRICE_VAT>
    ${p.brandName ? `<MANUFACTURER>${escapeXml(p.brandName)}</MANUFACTURER>` : ""}
    ${p.ean && isValidEan(p.ean) ? `<GTIN>${escapeXml(p.ean)}</GTIN>` : ""}
    ${p.categoryBreadcrumb ? `<CATEGORYTEXT>${escapeXml(p.categoryBreadcrumb)}</CATEGORYTEXT>` : ""}
    <DELIVERY_DATE>${deliveryDate}</DELIVERY_DATE>
${DELIVERY_METHODS.map(
  (d) => `    <DELIVERY>
      <DELIVERY_ID>${d.id}</DELIVERY_ID>
      <DELIVERY_PRICE>${d.price.toFixed(2)}</DELIVERY_PRICE>
      <DELIVERY_PRICE_COD>${(d.price + settings.codSurcharge).toFixed(2)}</DELIVERY_PRICE_COD>
    </DELIVERY>`,
).join("\n")}
${[...sizeParams, ...p.params]
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
