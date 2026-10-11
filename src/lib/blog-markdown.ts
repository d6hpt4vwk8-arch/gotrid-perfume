// Magazine articles are written as plain text in the admin textarea. Besides
// blank-line paragraphs, a few light markers give them structure:
//   ## Heading      ### Subheading
//   - list item     (every line of the block starts with "- ")
//   **bold**        [text](/produkt/slug)  or  [text](https://…)
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
      if (lines.every((l) => /^[-*]\s+/.test(l.trim()))) {
        return `<ul>${lines.map((l) => `<li>${inline(l.trim().replace(/^[-*]\s+/, ""))}</li>`).join("")}</ul>`;
      }
      return `<p>${lines.map(inline).join("<br>")}</p>`;
    })
    .join("\n");
}
