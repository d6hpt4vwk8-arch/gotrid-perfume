export function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/** Wraps text as CDATA — used for descriptions that may contain HTML from the product's rich-text field. */
export function cdata(value: string): string {
  return `<![CDATA[${value.replace(/]]>/g, "]]]]><![CDATA[>")}]]>`;
}

/** Strips HTML tags for feeds/fields that require plain text (e.g. Heureka DESCRIPTION prefers plain text). */
export function stripHtml(html: string): string {
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// Only ~11% of products have a real description — Zboží.cz's schema treats
// DESCRIPTION as a required element per item (unlike Heureka's, which
// tolerates omitting it), so a missing description fails their feed
// validator outright ("Expecting an element DESCRIPTION, got nothing").
// Falling back to the product name keeps every item's DESCRIPTION non-empty
// without inventing content.
export function feedDescription(product: { name: string; description: string | null }): string {
  return product.description ? stripHtml(product.description).slice(0, 5000) : product.name;
}

// A handful of imported EANs are malformed (a truncated barcode, or a
// number mangled by Excel's float precision loss during a spreadsheet
// import — recognizable by trailing zeros on an otherwise-implausible
// digit count) — Zboží.cz's schema rejects anything outside EAN-8/UPC-A/
// EAN-13/GTIN-14 and fails the ENTIRE feed's validation on the first bad
// one, so this is checked defensively everywhere EAN/GTIN is emitted
// rather than trusting the source data.
export function isValidEan(ean: string): boolean {
  return /^\d{8}$/.test(ean) || /^\d{12,14}$/.test(ean);
}
