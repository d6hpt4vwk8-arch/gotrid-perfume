import { SEO_URL } from "@/lib/site";

const ENTITIES: Record<string, string> = {
  "&amp;": "&",
  "&lt;": "<",
  "&gt;": ">",
  "&quot;": '"',
  "&#39;": "'",
  "&nbsp;": " ",
};

/** HTML (as stored in product/category descriptions) → one line of plain text. */
export function htmlToPlainText(html: string | null | undefined): string {
  if (!html) return "";
  return html
    .replace(/<(script|style)[\s\S]*?<\/\1>/gi, " ")
    .replace(/<\/?(a|b|strong|em|i|u|span|small|sup|sub)(\s[^>]*)?>/gi, "")
    .replace(/<br\s*\/?>|<\/(p|div|li|h[1-6])>/gi, " ")
    .replace(/<[^>]*>/g, " ")
    .replace(/&(amp|lt|gt|quot|nbsp|#39);/g, (m) => ENTITIES[m] ?? m)
    .replace(/\s+/g, " ")
    .replace(/\s+([,.;:!?])/g, "$1")
    .trim();
}

/** Cuts at a word boundary (a meta description is shown up to ~155 characters). */
export function truncateAtWord(text: string, max = 155): string {
  if (text.length <= max) return text;
  const cut = text.slice(0, max - 1);
  const lastSpace = cut.lastIndexOf(" ");
  return `${(lastSpace > max * 0.6 ? cut.slice(0, lastSpace) : cut).replace(/[\s,.;:–-]+$/, "")}…`;
}

/** Absolute URL on the public (www) host for a path like "/kategorie/parfemy". */
export function absoluteUrl(path: string): string {
  return `${SEO_URL}${path === "/" ? "" : path}`;
}

export function breadcrumbJsonLd(
  items: { name: string; path: string }[],
  labels: { home: string; homePath: string } = { home: "Domů", homePath: "/" },
) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [{ name: labels.home, path: labels.homePath }, ...items].map((item, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: item.name,
      item: absoluteUrl(item.path),
    })),
  };
}

/** Locale-prefixed path: "/produkt/x" → "/sk/produkt/x" on the Slovak storefront. */
export function localePath(locale: string, path: string): string {
  if (locale !== "sk") return path;
  return path === "/" ? "/sk" : `/sk${path}`;
}

/** canonical + hreflang alternates for a storefront page (path without locale prefix). */
export function localeAlternates(locale: string, path: string) {
  return {
    canonical: localePath(locale, path),
    languages: {
      cs: path,
      sk: localePath("sk", path),
      "x-default": path,
    },
  };
}
