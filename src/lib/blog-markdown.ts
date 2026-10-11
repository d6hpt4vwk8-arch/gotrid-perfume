// Magazine articles are written as plain text in the admin textarea. Besides
// blank-line paragraphs, a few light markers give them structure:
//   ## Heading      ### Subheading
//   - list item     (every line of the block starts with "- ")
//   **bold**        [text](/produkt/slug)  or  [text](https://…)
//   > text          callout box (lines may hold paragraphs and "- " lists)
//   [[produkt: slug | short note]]   product card; consecutive lines form one
//                   grid. Emitted as a <p> of marker lines that the article
//                   page swaps for real cards (see parseProductMarkers).
// Everything is HTML-escaped first, so the markers are the only way to get
// tags; sanitizeDescription() still runs at render time as the real boundary.
function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function inline(s: string): string {
  return escapeHtml(s)
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/\[([^\]]+)\]\(((?:https?:\/\/|\/)[^)\s]+)\)/g, '<a href="$2">$1</a>');
}

export function blogTextToHtml(text: string): string {
  return text
    .split(/\n\s*\n/)
    .map((block) => block.trim())
    .filter(Boolean)
    .map((block) => {
      if (/^###\s+/.test(block)) return `<h3>${inline(block.replace(/^###\s+/, ""))}</h3>`;
      if (/^##\s+/.test(block)) return `<h2>${inline(block.replace(/^##\s+/, ""))}</h2>`;
      const lines = block.split("\n");
      if (lines.every((l) => /^>\s?/.test(l.trim()))) {
        const inner = lines.map((l) => l.trim().replace(/^>\s?/, "")).join("\n");
        // Blank "> " lines split the callout into paragraphs / list blocks.
        return `<blockquote>${blogTextToHtml(inner.replace(/\n\s*\n/g, "\n\n"))}</blockquote>`;
      }
      if (lines.every((l) => PRODUCT_MARKER.test(l.trim()))) {
        return `<p>${lines.map((l) => escapeHtml(l.trim())).join("<br>")}</p>`;
      }
      if (lines.every((l) => /^[-*]\s+/.test(l.trim()))) {
        return `<ul>${lines.map((l) => `<li>${inline(l.trim().replace(/^[-*]\s+/, ""))}</li>`).join("")}</ul>`;
      }
      return `<p>${lines.map(inline).join("<br>")}</p>`;
    })
    .join("\n");
}

const PRODUCT_MARKER = /^\[\[produkt:\s*([a-z0-9-]+)\s*(?:\|\s*([^\]]*?))?\s*\]\]$/;

export type ProductMarker = { slug: string; note: string };

/** Splits stored article HTML into plain HTML chunks and product-card groups. */
export function splitArticleHtml(html: string): ({ html: string } | { products: ProductMarker[] })[] {
  const parts: ({ html: string } | { products: ProductMarker[] })[] = [];
  let last = 0;
  const re = /<p>((?:\[\[produkt:[^\]]*\]\](?:<br\s*\/?>)?)+)<\/p>/g;
  for (let m = re.exec(html); m; m = re.exec(html)) {
    if (m.index > last) parts.push({ html: html.slice(last, m.index) });
    const products = m[1]
      .split(/<br\s*\/?>/)
      .map((l) => PRODUCT_MARKER.exec(l.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").trim()))
      .filter((x): x is RegExpExecArray => !!x)
      .map((x) => ({ slug: x[1], note: (x[2] ?? "").trim() }));
    if (products.length) parts.push({ products });
    last = m.index + m[0].length;
  }
  if (last < html.length) parts.push({ html: html.slice(last) });
  return parts;
}
