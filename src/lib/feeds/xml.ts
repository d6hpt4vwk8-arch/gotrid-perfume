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

// GS1 check-digit algorithm — applies uniformly to EAN-8/UPC-A(12)/
// EAN-13/GTIN-14: weight 3 on the digit adjacent to the check digit,
// alternating with 1, summed right-to-left.
function hasValidEanChecksum(ean: string): boolean {
  const digits = ean.split("").map(Number);
  const check = digits.pop()!;
  let sum = 0;
  let weight = 3;
  for (let i = digits.length - 1; i >= 0; i--) {
    sum += digits[i] * weight;
    weight = weight === 3 ? 1 : 3;
  }
  return (10 - (sum % 10)) % 10 === check;
}

// A handful of imported EANs are malformed (a truncated barcode, a number
// mangled by Excel's float precision loss during a spreadsheet import —
// recognizable by trailing zeros on an otherwise-implausible digit count —
// or a value with the right length but a wrong check digit, i.e. a typo'd
// barcode). Zboží.cz's schema rejects anything outside EAN-8/UPC-A/EAN-13/
// GTIN-14 and fails the ENTIRE feed's validation on the first bad one, so
// this is checked defensively everywhere EAN/GTIN is emitted rather than
// trusting the source data.
export function isValidEan(ean: string): boolean {
  const formatOk = /^\d{8}$/.test(ean) || /^\d{12,14}$/.test(ean);
  return formatOk && hasValidEanChecksum(ean);
}
