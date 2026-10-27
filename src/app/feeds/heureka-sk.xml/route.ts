import { NextResponse } from "next/server";
import { getFeedProducts } from "@/lib/feeds/get-feed-products";
import { isPaidAdsEligible } from "@/lib/feeds/paid-ads-eligibility";
import { isConditionFlagged } from "@/lib/feeds/condition-flagged";
import { cdata, escapeXml, isValidEan } from "@/lib/feeds/xml";
import { czkToEur } from "@/lib/format";
import { categoryBreadcrumbSk, paramNameSk, paramValueSk } from "@/lib/sk-terms";
import { stripHtml } from "@/lib/feeds/xml";
import { SITE_URL } from "@/lib/site";
import { hasManufacturerReferencePrice } from "@/lib/reference-price";
import { getSettings } from "@/lib/settings.server";

// Slovak counterpart of heureka.xml — separate Heureka.sk shop account/feed
// registration from Heureka.cz, same reasoning throughout: EUR prices (every
// DB price is CZK, converted here with Settings.czkToEurRate — see
// checkout-form.tsx for the same conversion at checkout), and only
// Zásilkovna as a delivery method since that's the only carrier with a real
// Slovak network today (checkout-schema.ts enforces this at order time too).
// Heureka.sk requires the feed itself to be in Slovak (their registration
// help), so only products with a Slovak name AND description
// (Product.nameSk/descriptionSk, filled by scripts/sk-import.ts) are listed;
// the feed grows as translations are added. Category breadcrumbs and PARAMs
// are translated term by term via src/lib/sk-terms.ts.
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
      Boolean(p.nameSk && p.descriptionSk) &&
      !p.excludeFromHeureka &&
      !isConditionFlagged(p.name, p.isDefective) &&
      isPaidAdsEligible(p.code, p.brandName),
  );

  const items = products
    .map((p) => {
      // The Slovak storefront (language switcher + EUR prices), not the Czech page.
      const url = `${SITE_URL}/sk/produkt/${p.slug}`;
      const images = p.images.map((img) => `${SITE_URL}${img}`);
      const [mainImage, ...altImages] = images;
      const deliveryDate = p.stock > 0 ? "0" : "7";
      const productName = p.nameSk!;
      const description = stripHtml(p.descriptionSk!).slice(0, 5000);
      const priceEur = czkToEur(p.price, rate);
      // A manufacturer reference price is not our own "price before discount" — Heureka's PRICE_BEFORE must be the latter.
      const priceBeforeEur =
        p.compareAtPrice !== null && !hasManufacturerReferencePrice(p.brandName) ? czkToEur(p.compareAtPrice, rate) : null;

      return `  <SHOPITEM>
    <ITEM_ID>${escapeXml(p.code)}</ITEM_ID>
    <PRODUCTNAME>${escapeXml(productName)}</PRODUCTNAME>
    <DESCRIPTION>${cdata(description)}</DESCRIPTION>
    <URL>${escapeXml(url)}</URL>
    ${mainImage ? `<IMGURL>${escapeXml(mainImage)}</IMGURL>` : ""}
${altImages.map((img) => `    <IMGURL_ALTERNATIVE>${escapeXml(img)}</IMGURL_ALTERNATIVE>`).join("\n")}
    <PRICE_VAT>${priceEur.toFixed(2)}</PRICE_VAT>
    ${priceBeforeEur !== null ? `<PRICE_BEFORE>${priceBeforeEur.toFixed(2)}</PRICE_BEFORE>` : ""}
    ${p.brandName ? `<MANUFACTURER>${escapeXml(p.brandName)}</MANUFACTURER>` : ""}
    ${p.ean && isValidEan(p.ean) ? `<EAN>${escapeXml(p.ean)}</EAN>` : ""}
    ${p.categoryBreadcrumb ? `<CATEGORYTEXT>${escapeXml(categoryBreadcrumbSk(p.categoryBreadcrumb))}</CATEGORYTEXT>` : ""}
    <DELIVERY_DATE>${deliveryDate}</DELIVERY_DATE>
    <DELIVERY>
      <DELIVERY_ID>ZASILKOVNA</DELIVERY_ID>
      <DELIVERY_PRICE>${shippingPriceEur.toFixed(2)}</DELIVERY_PRICE>
      <DELIVERY_PRICE_COD>${(shippingPriceEur + codSurchargeEur).toFixed(2)}</DELIVERY_PRICE_COD>
    </DELIVERY>
${p.params
  .map(
    (param) =>
      `    <PARAM><PARAM_NAME>${escapeXml(paramNameSk(param.name))}</PARAM_NAME><VAL>${escapeXml(paramValueSk(param.value))}</VAL></PARAM>`,
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
      // force-dynamic (see comment above) skips Next's build-time cache, but
      // shopping-feed crawlers (Google, Heureka, Zboží, Glami, Meta) poll
      // these URLs many times a day — without this, every single hit was
      // re-querying the whole catalog and re-rendering the full XML from
      // scratch. s-maxage lets Vercel's edge cache the response for an hour;
      // stale-while-revalidate keeps serving that cached copy during the
      // background refresh instead of blocking a crawler on a cold render.
      "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=600",
    },
  });
}
