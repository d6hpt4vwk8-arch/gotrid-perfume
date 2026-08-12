import type { FeedProduct } from "./get-feed-products";
import { cdata, escapeXml, feedDescription } from "./xml";
import { SITE_URL } from "@/lib/site";

/**
 * RSS 2.0 + g: namespace feed — the shared format accepted by both Google
 * Merchant Center and Meta Commerce Manager (Meta explicitly supports the
 * Google Shopping XML schema as a catalog feed source).
 */
export function buildGoogleShoppingRss(products: FeedProduct[]): string {
  const items = products
    .map((p) => {
      const url = `${SITE_URL}/produkt/${p.slug}`;
      const image = p.images[0] ? `${SITE_URL}${p.images[0]}` : null;
      const extraImages = p.images.slice(1, 11).map((img) => `${SITE_URL}${img}`);

      return `    <item>
      <g:id>${escapeXml(p.code)}</g:id>
      <title>${escapeXml(p.name)}</title>
      <description>${cdata(feedDescription(p))}</description>
      <link>${escapeXml(url)}</link>
      ${image ? `<g:image_link>${escapeXml(image)}</g:image_link>` : ""}
${extraImages.map((img) => `      <g:additional_image_link>${escapeXml(img)}</g:additional_image_link>`).join("\n")}
      <g:availability>${p.stock > 0 ? "in stock" : "out of stock"}</g:availability>
      <g:price>${p.price.toFixed(2)} CZK</g:price>
      <g:condition>new</g:condition>
      ${p.brandName ? `<g:brand>${escapeXml(p.brandName)}</g:brand>` : ""}
      ${p.ean ? `<g:gtin>${escapeXml(p.ean)}</g:gtin>` : ""}
      ${p.categoryBreadcrumb ? `<g:product_type>${escapeXml(p.categoryBreadcrumb)}</g:product_type>` : ""}
      <g:identifier_exists>${p.ean ? "true" : "false"}</g:identifier_exists>
    </item>`;
    })
    .join("\n");

  return `<?xml version="1.0"?>
<rss version="2.0" xmlns:g="http://base.google.com/ns/1.0">
  <channel>
    <title>Gotrid Perfume</title>
    <link>${SITE_URL}</link>
    <description>Originální značková parfumerie, kosmetika a péče.</description>
${items}
  </channel>
</rss>`;
}
