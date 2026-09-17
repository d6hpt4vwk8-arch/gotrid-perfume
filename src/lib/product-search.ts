import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

/**
 * Exact substring match on name/EAN/brand — the fast, common-case search
 * that already existed. Kept as its own export so callers can try it first
 * and only pay for the fallback tiers below when it comes up empty.
 */
export function buildExactSearchWhere(query: string): Prisma.ProductWhereInput {
  return {
    OR: [
      { name: { contains: query, mode: "insensitive" } },
      { ean: { contains: query, mode: "insensitive" } },
      { brand: { name: { contains: query, mode: "insensitive" } } },
    ],
  };
}

/**
 * Second tier — the product's own description, not just its name/brand.
 * "Latafa Khamrah" won't match a product named "Lattafa Khamrah" via
 * substring, but this also catches the separate case the owner asked for:
 * a word that's only mentioned in the description, not the title.
 */
export function buildDescriptionSearchWhere(query: string): Prisma.ProductWhereInput {
  return { description: { contains: query, mode: "insensitive" } };
}

// pg_trgm (enabled 2026-09-19 for this) — word_similarity(query, name)
// scores how well the query matches the *best word-boundary substring* of
// the name, not the whole string, so a short query against a long product
// name ("Latafa" vs "Lattafa Khamrah Eau De Parfum 100 ml") still scores
// high (~0.7) instead of being diluted by the unrelated trigrams in the
// rest of the name (plain similarity() gave ~0.2 for the same pair —
// verified against the real catalog before picking word_similarity
// instead). 0.4 threshold and a 3-character minimum were both calibrated
// against real typos (Latafa/Lattafa, Shwarzkopf/Schwarzkopf both score
// 0.6-0.75) and a nonsense query (0 matches) before shipping this.
const FUZZY_THRESHOLD = 0.4;
const FUZZY_MIN_QUERY_LENGTH = 3;

/**
 * Third, last-resort tier — only when the exact and description tiers both
 * came up empty. Returns product IDs only (not full rows): callers should
 * re-query through Prisma with their own visible/stock/category filters
 * still applied on top of this ID list, rather than trusting this
 * unfiltered similarity ranking as the final answer.
 */
export async function findFuzzyProductIds(query: string, limit: number): Promise<string[]> {
  const trimmed = query.trim();
  if (trimmed.length < FUZZY_MIN_QUERY_LENGTH) return [];

  const rows = await prisma.$queryRaw<{ id: string }[]>`
    SELECT id FROM "Product"
    WHERE visible = true AND word_similarity(${trimmed}, name) > ${FUZZY_THRESHOLD}
    ORDER BY word_similarity(${trimmed}, name) DESC
    LIMIT ${limit}
  `;
  return rows.map((r) => r.id);
}
