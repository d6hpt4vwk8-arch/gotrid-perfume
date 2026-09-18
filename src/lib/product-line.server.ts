import { prisma } from "@/lib/prisma";
import { primaryVariantWhere } from "@/lib/product-filters";

// Matches the first fragrance-format word in a product name (EDP/EDT/
// deodorant/miniature/set/…) — everything before it is the "line name"
// (brand + scent), everything from it onward is the format/size/gender
// noise that differs between a perfume and its matching deodorant or
// travel size. Deliberately conservative: a named flanker ("Zanzibar",
// "Elixir", "Bourbon") stays part of the line name, so a base scent only
// merges with a sibling that repeats the same flanker word, never with an
// unrelated variant that just happens to share the brand + base name.
const FORMAT_TOKEN_PATTERN =
  /\b(eau de parfum|eau de toilette|eau de cologne|parf[eé]movan[áé] voda|toaletn[íi] voda|kolínsk[áé] voda|extrait de parfum|parf[eé]mov[ýy] olej|deodorant|deo|sprej|vapo|bytov[ýy] sprej|miniatura|miniature|tester|sada|collection|set|edp|edt|edc)\b/i;

export function computeLineKey(name: string): string | null {
  const match = name.match(FORMAT_TOKEN_PATTERN);
  if (!match || match.index === undefined || match.index === 0) return null;
  const line = name.slice(0, match.index).trim();
  if (line.split(/\s+/).filter(Boolean).length < 2) return null;
  return line.toLowerCase();
}

/**
 * Other formats of the exact same fragrance (deodorant, body spray,
 * miniature, gift set) sharing this product's brand and scent name —
 * distinct from getRelatedProducts (same category, any scent) and
 * getFrequentlyBoughtTogether (co-purchase history, any relation). Someone
 * already sold on this specific scent is a much easier upsell for its own
 * deodorant than a same-category stranger.
 */
export async function getSameLineProducts(
  product: { id: string; name: string; brandId: string | null },
  limit = 4,
) {
  if (!product.brandId) return [];
  const lineKey = computeLineKey(product.name);
  if (!lineKey) return [];

  const brandProducts = await prisma.product.findMany({
    where: {
      brandId: product.brandId,
      id: { not: product.id },
      visible: true,
      stock: { gt: 0 },
      ...primaryVariantWhere,
    },
    include: { brand: true, images: { orderBy: { sortOrder: "asc" }, take: 1 } },
  });

  return brandProducts.filter((p) => computeLineKey(p.name) === lineKey).slice(0, limit);
}
