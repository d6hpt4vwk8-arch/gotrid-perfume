/**
 * Safe to embed inside a <script type="application/ld+json"> via
 * dangerouslySetInnerHTML. Plain JSON.stringify doesn't escape "</script>",
 * so a description or title containing that literal string would terminate
 * the script tag early and let the rest of the JSON be parsed as HTML/JS.
 */
export function jsonLdScript(data: unknown): string {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}
