import { Prisma } from "@prisma/client";
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
      // Slovak storefront: shoppers type Slovak spellings ("šampón", "sviečka").
      { nameSk: { contains: query, mode: "insensitive" } },
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
  return {
    OR: [
      { description: { contains: query, mode: "insensitive" } },
      { descriptionSk: { contains: query, mode: "insensitive" } },
    ],
  };
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
    WHERE visible = true AND GREATEST(word_similarity(${trimmed}, name), word_similarity(${trimmed}, COALESCE("nameSk", ''))) > ${FUZZY_THRESHOLD}
    ORDER BY GREATEST(word_similarity(${trimmed}, name), word_similarity(${trimmed}, COALESCE("nameSk", ''))) DESC
    LIMIT ${limit}
  `;
  return rows.map((r) => r.id);
}


// ---------------------------------------------------------------------------
// Token tier — multi-word queries and Czech word forms.
//
// The exact tier above matches the *whole phrase* as one substring, so
// "sprchové gely dermacol" or "mastičky bylinkové 150 ml řepík lékařský"
// found nothing even though "Dermacol … sprchový gel" and "bylinná mast řepík
// lékařský 150 ml" exist (SearchLog showed these as zero-result queries).
// Here each word is matched on its own, accent-insensitively and by a short
// stem ("gely"→"gel", "sprchové"→"sprcho"), plus a few synonyms for words
// shoppers use that never appear in product names ("mastičky" for "mast",
// "intim gel" for "lubrikační gel", "šnečí sliz" for "hlemýždí extrakt").
// ---------------------------------------------------------------------------

const ACCENTS_FROM = "áäčďéěëíňóöřšťúůüýžÁÄČĎÉĚËÍŇÓÖŘŠŤÚŮÜÝŽ";
const ACCENTS_TO = "aacdeeeinoorstuuuyzAACDEEEINOORSTUUUYZ";

const SEARCH_STOPWORDS = new Set(["a", "i", "na", "pro", "s", "se", "v", "z", "do", "od", "ml", "g", "ks", "the"]);

// Query word (normalized, stemmed prefix match) → alternative strings that may
// appear in a product name instead. Any alternative satisfies that word.
const SEARCH_SYNONYMS: [RegExp, string[]][] = [
  // Padded with spaces so "mast" (ointment) doesn't match "mastná" (oily skin).
  [/^mastic|^mastick|^mastich/, [" mast ", " masti "]],
  [/^intim/, ["intim", "lubrik"]],
  [/^(snec|sneci|slimak|sliz|hlemyzd)/, ["hlemyzd", "snail"]],
  [/^(lipbalm|lipbakm|lipbaum|lipbam)/, ["balzam na rty", "lip balm"]],
  [/^(tonikum|tonik|toner)/, ["tonik", "toner", "pletova voda"]],
  [/^(vzorek|vzorky|vzorku|samplu?)/, ["vzorek", "dekant", "sample"]],
  [/^(kartac|zubni kartac)/, ["kartac"]],
  [/^erotic/, ["erotic", "lubrik", "kondom", "cannasex"]],
];

export function normalizeSearchText(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function stemSearchToken(token: string): string {
  if (/^\d/.test(token) || token.length <= 3) return token;
  if (token.length === 4) return /[yeai]$/.test(token) ? token.slice(0, 3) : token;
  return token.slice(0, Math.max(4, token.length - 2));
}

/** Word groups for the token tier; each group is a list of alternatives (any one matches the word). */
export function buildSearchTokenGroups(query: string): string[][] {
  const words = normalizeSearchText(query)
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length >= 2 && !SEARCH_STOPWORDS.has(w));
  const groups: string[][] = [];
  for (const word of words.slice(0, 8)) {
    const stem = stemSearchToken(word);
    const synonym = SEARCH_SYNONYMS.find(([re]) => re.test(word));
    groups.push(synonym ? [stem, ...synonym[1]] : [stem]);
  }
  return groups;
}

/**
 * Product IDs whose name/brand/EAN match every word of the query (mode "all"),
 * or at least ~60% of them (mode "most", for queries with an extra descriptive
 * word that isn't in the name). Returns IDs only so callers re-apply their own
 * visible/SK/filter scoping, same contract as findFuzzyProductIds.
 */
export async function findTokenProductIds(query: string, limit: number, mode: "all" | "most" = "all"): Promise<string[]> {
  const groups = buildSearchTokenGroups(query);
  if (groups.length === 0) return [];
  if (mode === "most" && groups.length < 3) return [];
  const needed = mode === "all" ? groups.length : Math.max(2, Math.ceil(groups.length * 0.6));

  const norm = (col: Prisma.Sql) => Prisma.sql`translate(lower(${col}), ${ACCENTS_FROM}, ${ACCENTS_TO})`;
  // Padded with spaces so a synonym like " mast " only matches the whole word.
  const nameN = Prisma.sql`(' ' || ${norm(Prisma.sql`p.name`)} || ' ')`;
  const nameSkN = norm(Prisma.sql`COALESCE(p."nameSk", '')`);
  const brandN = norm(Prisma.sql`COALESCE(b.name, '')`);

  const matched = groups.map((alts) => {
    const conds = alts.flatMap((alt) => {
      const like = `%${alt.replace(/[%_\\]/g, "")}%`;
      return [
        Prisma.sql`${nameN} LIKE ${like}`,
        Prisma.sql`${nameSkN} LIKE ${like}`,
        Prisma.sql`${brandN} LIKE ${like}`,
        Prisma.sql`COALESCE(p.ean, '') LIKE ${like}`,
        // Category names too: "korejská kosmetika" is a category, not in any product name.
        Prisma.sql`EXISTS (SELECT 1 FROM "ProductCategory" pc JOIN "Category" c ON c.id = pc."categoryId" WHERE pc."productId" = p.id AND ${norm(Prisma.sql`c.name`)} LIKE ${like})`,
      ];
    });
    return Prisma.sql`(CASE WHEN ${Prisma.join(conds, " OR ")} THEN 1 ELSE 0 END)`;
  });
  const score = Prisma.join(matched, " + ");

  const rows = await prisma.$queryRaw<{ id: string }[]>`
    SELECT p.id FROM "Product" p LEFT JOIN "Brand" b ON b.id = p."brandId"
    WHERE p.visible = true AND (${score}) >= ${needed}
    ORDER BY (${score}) DESC, p."createdAt" DESC
    LIMIT ${limit}
  `;
  return rows.map((r) => r.id);
}
