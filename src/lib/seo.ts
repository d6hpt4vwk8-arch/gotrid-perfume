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

export const DEFAULT_OG_IMAGE = "/og-default.png";

/**
 * Open Graph + Twitter card for a page. Next replaces (not merges) a layout's openGraph with the page's,
 * so every page that sets its own title/description needs a complete object — build it here.
 */
export function ogMeta(opts: {
  title: string;
  description: string;
  /** Path without host, already locale-prefixed (the canonical path). */
  path: string;
  locale: string;
  image?: string | null;
  type?: "website" | "article";
  publishedTime?: Date;
  modifiedTime?: Date;
}) {
  const image = opts.image || DEFAULT_OG_IMAGE;
  const imageUrl = image.startsWith("http") ? image : absoluteUrl(image);
  return {
    openGraph: {
      type: opts.type ?? "website",
      siteName: "Gotrid Perfume",
      locale: opts.locale === "sk" ? "sk_SK" : "cs_CZ",
      title: opts.title,
      description: opts.description,
      url: absoluteUrl(opts.path),
      images: [{ url: imageUrl }],
      ...(opts.type === "article"
        ? {
            publishedTime: opts.publishedTime?.toISOString(),
            modifiedTime: opts.modifiedTime?.toISOString(),
          }
        : {}),
    },
    twitter: {
      card: "summary_large_image" as const,
      title: opts.title,
      description: opts.description,
      images: [imageUrl],
    },
  };
}

/** "od 27 Kč" / "od 1,10 €" for a meta description (plain space, no NBSP). */
export function priceFromLabel(minCzk: number, isSk: boolean, eurRate: number, from: string): string {
  if (isSk) return `${from} ${(minCzk / eurRate).toFixed(2).replace(".", ",")} €`;
  return `${from} ${Math.max(1, Math.floor(minCzk))} Kč`;
}

/** CollectionPage + ItemList for a listing page (first page of products only). */
export function collectionJsonLd(opts: {
  name: string;
  description?: string;
  path: string;
  items: { name: string; path: string }[];
}) {
  return {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: opts.name,
    ...(opts.description ? { description: opts.description } : {}),
    url: absoluteUrl(opts.path),
    isPartOf: { "@type": "WebSite", name: "Gotrid Perfume", url: absoluteUrl("/") },
    mainEntity: {
      "@type": "ItemList",
      numberOfItems: opts.items.length,
      itemListElement: opts.items.map((it, i) => ({
        "@type": "ListItem",
        position: i + 1,
        url: absoluteUrl(it.path),
        name: it.name,
      })),
    },
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
