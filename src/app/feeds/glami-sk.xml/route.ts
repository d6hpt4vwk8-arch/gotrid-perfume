import { NextResponse } from "next/server";
import { getFeedProducts } from "@/lib/feeds/get-feed-products";
import { isPaidAdsEligible } from "@/lib/feeds/paid-ads-eligibility";
import { isConditionFlagged } from "@/lib/feeds/condition-flagged";
import { cdata, escapeXml, isValidEan, stripHtml } from "@/lib/feeds/xml";
import { czkToEur } from "@/lib/format";
import { categoryBreadcrumbSk, paramNameSk, paramValueSk } from "@/lib/sk-terms";
import { stripVolume } from "@/lib/parse-volume";
import { SEO_URL } from "@/lib/site";
import { getSettings } from "@/lib/settings.server";

// Slovak counterpart of glami.xml for a separate GLAMI.sk shop registration (2026-11-08): EUR prices (every DB price is
// CZK, converted with Settings.czkToEurRate like the Heureka.sk feed), the Slovak storefront URLs (/sk/produkt/…), Slovak
// product copy (only products with nameSk AND descriptionSk, the list grows as translations are added) and only the
// carriers with a real Slovak network — GLS and Zásilkovna (checkout-schema.ts enforces the same at order time).
// Same eligibility as glami.xml (pay-per-click, see paid-ads-eligibility.ts) and the same MANUFACTURER / volume rules.
export const dynamic = "force-dynamic";

export async function GET() {
  const settings = await getSettings();
  const rate = settings.czkToEurRate;
  const zasilkovnaEur = czkToEur(settings.shippingPriceZasilkovnaSk ?? settings.shippingPrices.ZASILKOVNA, rate);
  const glsParcelshopEur = czkToEur(settings.shippingPriceGlsMistoSk ?? settings.shippingPrices.GLS_MISTO, rate);
  const glsCourierEur = czkToEur(settings.shippingPriceGlsSk ?? settings.shippingPrices.GLS, rate);
  const codSurchargeEur = czkToEur(settings.codSurcharge, rate);

  const allProducts = await getFeedProducts();
  const products = allProducts.filter(
    (p) =>
      p.stock > 0 &&
      Boolean(p.nameSk && p.descriptionSk) &&
      p.brandName &&
      !isConditionFlagged(p.name, p.isDefective) &&
      isPaidAdsEligible(p.code, p.brandName),
  );

  const items = products
    .map((p) => {
      const url = `${SEO_URL}/sk/produkt/${p.slug}`;
      const images = p.images.map((img) => `${SEO_URL}${img}`);
      const [mainImage, ...altImages] = images;
      const deliveryDate = p.stock > 0 ? "0" : "7";
      // Same as glami.xml: GLAMI wants the volume as a separate velikost/size_system PARAM, not inside the name.
      const volumeParam = p.params.find((param) => param.name === "Objem");
      const sizeParams = volumeParam
        ? [
            { name: "velikost", value: volumeParam.value },
            { name: "size_system", value: "INT" },
          ]
        : [];
      const productName = stripVolume(p.nameSk!);
      const description = stripHtml(p.descriptionSk!).slice(0, 5000);
      const priceEur = czkToEur(p.price, rate);

      return `  <SHOPITEM>
    <ITEM_ID>${escapeXml(p.code)}</ITEM_ID>
    <ITEMGROUP_ID>${escapeXml(p.code)}</ITEMGROUP_ID>
    <PRODUCTNAME>${escapeXml(productName)}</PRODUCTNAME>
    <DESCRIPTION>${cdata(description)}</DESCRIPTION>
    <URL>${escapeXml(url)}</URL>
    <URL_SIZE>${escapeXml(url)}</URL_SIZE>
    ${mainImage ? `<IMGURL>${escapeXml(mainImage)}</IMGURL>` : ""}
${altImages.map((img) => `    <IMGURL_ALTERNATIVE>${escapeXml(img)}</IMGURL_ALTERNATIVE>`).join("\n")}
    <PRICE_VAT>${priceEur.toFixed(2)}</PRICE_VAT>
    <MANUFACTURER>${escapeXml(p.brandName!)}</MANUFACTURER>
    ${p.ean && isValidEan(p.ean) ? `<GTIN>${escapeXml(p.ean)}</GTIN>` : ""}
    ${p.categoryBreadcrumb ? `<CATEGORYTEXT>${escapeXml(categoryBreadcrumbSk(p.categoryBreadcrumb))}</CATEGORYTEXT>` : ""}
    <DELIVERY_DATE>${deliveryDate}</DELIVERY_DATE>
    <DELIVERY>
      <DELIVERY_ID>GLS_PARCELSHOP</DELIVERY_ID>
      <DELIVERY_PRICE>${glsParcelshopEur.toFixed(2)}</DELIVERY_PRICE>
    </DELIVERY>
    <DELIVERY>
      <DELIVERY_ID>ZASILKOVNA</DELIVERY_ID>
      <DELIVERY_PRICE>${zasilkovnaEur.toFixed(2)}</DELIVERY_PRICE>
      <DELIVERY_PRICE_COD>${(zasilkovnaEur + codSurchargeEur).toFixed(2)}</DELIVERY_PRICE_COD>
    </DELIVERY>
    <DELIVERY>
      <DELIVERY_ID>GLS</DELIVERY_ID>
      <DELIVERY_PRICE>${glsCourierEur.toFixed(2)}</DELIVERY_PRICE>
    </DELIVERY>
${[...sizeParams, ...p.params.map((param) => ({ name: paramNameSk(param.name), value: paramValueSk(param.value) }))]
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
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=600",
    },
  });
}
