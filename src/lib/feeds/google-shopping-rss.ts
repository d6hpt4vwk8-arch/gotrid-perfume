import type { FeedProduct } from "./get-feed-products";
import { cdata, escapeXml, isValidEan } from "./xml";
import { SEO_URL } from "@/lib/site";

/**
 * One offer per GTIN: the same product is sometimes imported twice (Tamda and SP Venture) with slightly
 * different prices, and Google then sees two items claiming one identity. Keep the one that is in stock,
 * then the cheaper one. Items without a valid GTIN are never merged.
 */
export function dedupeByGtin(products: FeedProduct[]): FeedProduct[] {
  const best = new Map<string, FeedProduct>();
  for (const p of products) {
    if (!p.ean || !isValidEan(p.ean)) continue;
    const current = best.get(p.ean);
    if (!current) {
      best.set(p.ean, p);
      continue;
    }
    const better =
      (p.stock > 0) !== (current.stock > 0) ? p.stock > 0 : p.price !== current.price ? p.price < current.price : p.code < current.code;
    if (better) best.set(p.ean, p);
  }
  return products.filter((p) => !p.ean || !isValidEan(p.ean) || best.get(p.ean) === p);
}

/**
 * RSS 2.0 + g: namespace feed — the shared format accepted by both Google
 * Merchant Center and Meta Commerce Manager (Meta explicitly supports the
 * Google Shopping XML schema as a catalog feed source).
 */
export function buildGoogleShoppingRss(products: FeedProduct[]): string {
  // SEO_URL = the canonical www host: feed links must not go through the apex → www 308.
  const items = dedupeByGtin(products)
    .map((p) => {
      const url = `${SEO_URL}/produkt/${p.slug}`;
      const image = p.images[0] ? `${SEO_URL}${p.images[0]}` : null;
      const extraImages = p.images.slice(1, 11).map((img) => `${SEO_URL}${img}`);

      return `    <item>
      <g:id>${escapeXml(p.code)}</g:id>
      <title>${escapeXml(p.name)}</title>
      <description>${cdata(p.description)}</description>
      <link>${escapeXml(url)}</link>
      ${image ? `<g:image_link>${escapeXml(image)}</g:image_link>` : ""}
${extraImages.map((img) => `      <g:additional_image_link>${escapeXml(img)}</g:additional_image_link>`).join("\n")}
      <g:availability>${p.stock > 0 ? "in stock" : "out of stock"}</g:availability>
      <g:price>${p.price.toFixed(2)} CZK</g:price>
      <g:condition>new</g:condition>
      ${p.brandName ? `<g:brand>${escapeXml(p.brandName)}</g:brand>` : ""}
      ${p.ean && isValidEan(p.ean) ? `<g:gtin>${escapeXml(p.ean)}</g:gtin>` : ""}
      ${p.categoryBreadcrumb ? `<g:product_type>${escapeXml(p.categoryBreadcrumb)}</g:product_type>` : ""}
      <g:identifier_exists>${p.ean && isValidEan(p.ean) ? "true" : "false"}</g:identifier_exists>
    </item>`;
    })
    .join("\n");

  return `<?xml version="1.0"?>
<rss version="2.0" xmlns:g="http://base.google.com/ns/1.0">
  <channel>
    <title>Gotrid Perfume</title>
    <link>${SEO_URL}</link>
    <description>Originální značková parfumerie, kosmetika a péče.</description>
${items}
  </channel>
</rss>`;
}
