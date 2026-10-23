// Structured product-page blocks stored in Product.details (JSON): who the product is for, key ingredients,
// how to use it, what to expect and a short FAQ. Shape: { cs: ProductDetails, sk?: ProductDetails }. The Slovak
// storefront falls back to Czech when `sk` is missing. Written by scripts/apply-product-details.ts.

export interface ProductDetails {
  forWhom?: string;
  ingredients?: { name: string; text: string }[];
  howToUse?: string[];
  expect?: string;
  faq?: { q: string; a: string }[];
}

export interface ProductDetailsStored {
  cs?: ProductDetails;
  sk?: ProductDetails;
}

function isNonEmptyString(v: unknown): v is string {
  return typeof v === "string" && v.trim().length > 0;
}

function clean(raw: unknown): ProductDetails | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const ingredients = Array.isArray(r.ingredients)
    ? r.ingredients
        .filter((i): i is { name: string; text: string } => !!i && isNonEmptyString((i as { name?: unknown }).name) && isNonEmptyString((i as { text?: unknown }).text))
        .map((i) => ({ name: i.name, text: i.text }))
    : [];
  const howToUse = Array.isArray(r.howToUse) ? r.howToUse.filter(isNonEmptyString) : [];
  const faq = Array.isArray(r.faq)
    ? r.faq
        .filter((f): f is { q: string; a: string } => !!f && isNonEmptyString((f as { q?: unknown }).q) && isNonEmptyString((f as { a?: unknown }).a))
        .map((f) => ({ q: f.q, a: f.a }))
    : [];
  const out: ProductDetails = {
    forWhom: isNonEmptyString(r.forWhom) ? r.forWhom : undefined,
    ingredients: ingredients.length ? ingredients : undefined,
    howToUse: howToUse.length ? howToUse : undefined,
    expect: isNonEmptyString(r.expect) ? r.expect : undefined,
    faq: faq.length ? faq : undefined,
  };
  return Object.values(out).some(Boolean) ? out : null;
}

/** Picks the blocks for the locale (Slovak falls back to Czech); null when the product has none. */
export function pickProductDetails(stored: unknown, locale: "cs" | "sk"): ProductDetails | null {
  if (!stored || typeof stored !== "object") return null;
  const s = stored as ProductDetailsStored;
  return (locale === "sk" ? clean(s.sk) ?? clean(s.cs) : clean(s.cs)) ?? null;
}
