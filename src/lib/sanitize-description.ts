import sanitizeHtml from "sanitize-html";

/**
 * Product descriptions come from imported XLSX/feed data (TZ §6.2) and are
 * rendered as raw HTML — sanitize at render time so a compromised or
 * malformed source can't inject a stored XSS payload, regardless of what
 * ended up in the database already.
 */
export function sanitizeDescription(html: string): string {
  return sanitizeHtml(html, {
    allowedTags: [
      "p", "br", "b", "strong", "i", "em", "u", "ul", "ol", "li",
      "h2", "h3", "h4", "span", "a", "blockquote",
    ],
    allowedAttributes: {
      a: ["href", "target", "rel"],
    },
    allowedSchemes: ["http", "https", "mailto"],
    transformTags: {
      a: sanitizeHtml.simpleTransform("a", { rel: "noopener noreferrer" }),
    },
  });
}
