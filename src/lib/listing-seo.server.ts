import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { primaryVariantWhere } from "@/lib/product-filters";
import { getSettings } from "@/lib/settings.server";
import { priceFromLabel, truncateAtWord } from "@/lib/seo";

export type ListingStats = {
  count: number;
  minPrice: number | null;
  maxPrice: number | null;
  /** Names of the best-selling in-stock products (brand prefix kept as stored). */
  bestsellers: string[];
};

/** Count, price range and bestsellers of what a listing page actually shows (in stock, primary variants). */
export async function getListingStats(where: Prisma.ProductWhereInput): Promise<ListingStats> {
  const scoped: Prisma.ProductWhereInput = { AND: [where, { visible: true, stock: { gt: 0 } }, primaryVariantWhere] };
  const [agg, top] = await Promise.all([
    prisma.product.aggregate({ where: scoped, _count: { _all: true }, _min: { price: true }, _max: { price: true } }),
    prisma.product.findMany({
      where: scoped,
      orderBy: [{ salesCount: "desc" }, { priority: "desc" }],
      take: 2,
      select: { name: true },
    }),
  ]);
  return {
    count: agg._count._all,
    minPrice: agg._min.price !== null ? Number(agg._min.price) : null,
    maxPrice: agg._max.price !== null ? Number(agg._max.price) : null,
    bestsellers: top.map((p) => p.name),
  };
}

/**
 * Concrete, page-specific meta description: how many products, price range, bestsellers, shipping terms.
 * `lead` is an optional curated sentence (category intro) appended after the facts.
 */
export async function listingDescription(opts: {
  name: string;
  stats: ListingStats;
  isSk: boolean;
  lead?: string;
  bestsellers?: string[];
}): Promise<string> {
  const { name, stats, isSk } = opts;
  const settings = await getSettings();
  const rate = Number(settings.czkToEurRate);
  const threshold = settings.freeShippingThreshold;
  if (stats.count === 0 || stats.minPrice === null) return opts.lead ? truncateAtWord(opts.lead) : name;

  const from = priceFromLabel(stats.minPrice, isSk, rate, "od");
  const noun = (n: number) =>
    isSk ? (n === 1 ? "produkt" : n < 5 ? "produkty" : "produktov") : n === 1 ? "produkt" : n < 5 ? "produkty" : "produktů";
  const free = isSk
    ? `Doprava zadarmo od ${(threshold / rate).toFixed(0)} €.`
    : `Doprava zdarma od ${new Intl.NumberFormat("cs-CZ").format(threshold).replace(/\s/g, " ")} Kč.`;
  // Short product names: "Lattafa Eclaire Pistache – parfémovaná voda unisex – 100 ml" → "Lattafa Eclaire Pistache".
  const best = (opts.bestsellers ?? stats.bestsellers).map((n) => n.split(/\s[–-]\s/)[0].trim()).slice(0, 2);
  const bestText = best.length ? `${isSk ? "Najpredávanejšie" : "Nejprodávanější"}: ${best.join(", ")}.` : "";

  const facts = `${name}: ${stats.count} ${noun(stats.count)} ${isSk ? "skladom" : "skladem"} ${from}.`;
  const tail = isSk ? "Vrátenie do 14 dní." : "Vrácení do 14 dnů.";

  // Add pieces in priority order, each only if it fits whole — a snippet cut mid-sentence reads worse than a shorter one.
  const MAX = 158;
  let out = facts;
  const candidates = opts.lead ? [firstSentences(opts.lead, 125), free, tail] : [bestText, free, tail];
  for (const piece of candidates) {
    if (piece && `${out} ${piece}`.length <= MAX) out = `${out} ${piece}`;
  }
  return out;
}

/** Whole sentences of `text` up to `max` characters ("" when even the first one is longer). */
function firstSentences(text: string, max: number): string {
  const sentences = text.match(/[^.!?]+[.!?]+(\s|$)/g) ?? [];
  let out = "";
  for (const sentence of sentences) {
    const next = `${out}${sentence}`.trim();
    if (next.length > max) break;
    out = `${next} `;
  }
  return out.trim();
}

/** Title that carries the same facts: "Lattafa – 87 produktů od 129 Kč | Gotrid Perfume". */
export async function listingTitle(opts: { name: string; stats: ListingStats; isSk: boolean }): Promise<string> {
  const { name, stats, isSk } = opts;
  if (stats.count === 0 || stats.minPrice === null) return `${name} | Gotrid Perfume`;
  const settings = await getSettings();
  const from = priceFromLabel(stats.minPrice, isSk, Number(settings.czkToEurRate), "od");
  const word = isSk
    ? stats.count === 1 ? "produkt" : stats.count < 5 ? "produkty" : "produktov"
    : stats.count === 1 ? "produkt" : stats.count < 5 ? "produkty" : "produktů";
  return `${name} – ${stats.count} ${word} ${from} | Gotrid Perfume`;
}
