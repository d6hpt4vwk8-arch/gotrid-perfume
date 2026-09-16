import { NextResponse } from "next/server";
import { getFeedProducts } from "@/lib/feeds/get-feed-products";
import { isPaidAdsEligible } from "@/lib/feeds/paid-ads-eligibility";
import { isConditionFlagged } from "@/lib/feeds/condition-flagged";
import { cdata, escapeXml, isValidEan } from "@/lib/feeds/xml";
import { czkToEur } from "@/lib/format";
import { SITE_URL } from "@/lib/site";
import { getSettings } from "@/lib/settings.server";

// Slovak counterpart of heureka.xml — separate Heureka.sk shop account/feed
// registration from Heureka.cz, same reasoning throughout: EUR prices (every
// DB price is CZK, converted here with Settings.czkToEurRate — see
// checkout-form.tsx for the same conversion at checkout), and only
// Zásilkovna as a delivery method since that's the only carrier with a real
// Slovak network today (checkout-schema.ts enforces this at order time too).
// Product names/descriptions are still Czech — no Slovak translation exists
// yet (see src/i18n/routing.ts's Phase 0/1 comment); Czech and Slovak are
// close enough that Heureka.sk accepts this in practice, but retranslating
// is real future work, not done here.
export const dynamic = "force-dynamic";

export async function GET() {
  const settings = await getSettings();
  const rate = settings.czkToEurRate;
  const shippingPriceEur = czkToEur(
    settings.shippingPriceZasilkovnaSk ?? settings.shippingPrices.ZASILKOVNA,
    rate,
  );
  const codSurchargeEur = czkToEur(settings.codSurcharge, rate);

  const allProducts = await getFeedProducts();
  const products = allProducts.filter(
    (p) =>
      p.stock > 0 &&
      !p.excludeFromHeureka &&
      !isConditionFlagged(p.name, p.isDefective) &&
      isPaidAdsEligible(p.code, p.brandName),
  );

  const items = products
    .map((p) => {
      const url = `${SITE_URL}/produkt/${p.slug}`;
      const images = p.images.map((img) => `${SITE_URL}${img}`);
      const [mainImage, ...altImages] = images;
      const deliveryDate = p.stock > 0 ? "0" : "7";
      const productName = p.heurekaName ?? p.name;
      const priceEur = czkToEur(p.price, rate);
      const priceBeforeEur = p.compareAtPrice !== null ? czkToEur(p.compareAtPrice, rate) : null;

      return `  <SHOPITEM>
    <ITEM_ID>${escapeXml(p.code)}</ITEM_ID>
    <PRODUCTNAME>${escapeXml(productName)}</PRODUCTNAME>
    <DESCRIPTION>${cdata(p.description)}</DESCRIPTION>
    <URL>${escapeXml(url)}</URL>
    ${mainImage ? `<IMGURL>${escapeXml(mainImage)}</IMGURL>` : ""}
${altImages.map((img) => `    <IMGURL_ALTERNATIVE>${escapeXml(img)}</IMGURL_ALTERNATIVE>`).join("\n")}
    <PRICE_VAT>${priceEur.toFixed(2)}</PRICE_VAT>
    ${priceBeforeEur !== null ? `<PRICE_BEFORE>${priceBeforeEur.toFixed(2)}</PRICE_BEFORE>` : ""}
    ${p.brandName ? `<MANUFACTURER>${escapeXml(p.brandName)}</MANUFACTURER>` : ""}
    ${p.ean && isValidEan(p.ean) ? `<EAN>${escapeXml(p.ean)}</EAN>` : ""}
    ${p.categoryBreadcrumb ? `<CATEGORYTEXT>${escapeXml(p.categoryBreadcrumb)}</CATEGORYTEXT>` : ""}
    <DELIVERY_DATE>${deliveryDate}</DELIVERY_DATE>
    <DELIVERY>
      <DELIVERY_ID>ZASILKOVNA</DELIVERY_ID>
      <DELIVERY_PRICE>${shippingPriceEur.toFixed(2)}</DELIVERY_PRICE>
      <DELIVERY_PRICE_COD>${(shippingPriceEur + codSurchargeEur).toFixed(2)}</DELIVERY_PRICE_COD>
    </DELIVERY>
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
