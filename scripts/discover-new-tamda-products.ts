// Weekly discovery pass for new Tamda Express products, per the owner's
// 2026-09-28 request: Tamda's own "Product New" filter (used once ad hoc
// that day) turned out to miss real new items (an owner spot-check found a
// Bispol candle it never flagged) — this script instead enumerates category
// listing pages directly and diffs the discovered product IDs against our
// own catalog, which is exhaustive rather than dependent on Tamda's own
// "new" flag.
//
// No login required for this discovery phase: category grid pages show
// each product's `data-product-id` to anonymous visitors (price/EAN are
// hidden pre-login, but that's fine here — those are only needed for
// candidates that turn out to be genuinely new). Confirmed empirically
// 2026-09-28 that Tamda's own pagination is NOT stable offset-based paging
// (re-fetching "page 2" returns a different partially-overlapping sample
// each time, observed 66→187→247→307 unique IDs across 5 fetches of the
// same category with no sign of convergence at a fixed page count) — so
// this fetches a generous, fixed number of pages per category and unions
// the results, rather than trying to detect "last page reached".
//
// Usage:
//   npx tsx scripts/discover-new-tamda-products.ts
//   npx tsx scripts/discover-new-tamda-products.ts --pages=40
//
// Output: prints a summary, and writes full candidate details (name, EAN,
// category breadcrumb, product URL) to scripts/tamda-data/new-candidates-<date>.json
// for manual review — this script only discovers and reports, it does not
// create products. Candidates still need a live stock/price check (Tamda
// hides that from anonymous requests) via the "Objednávka z CSV" tool
// before importing, same as the 2026-09-28 backlog and "Product New" batches.

import { writeFileSync } from "node:fs";
import { prisma } from "../src/lib/prisma";

const PAGES_PER_CATEGORY = Number(process.argv.find((a) => a.startsWith("--pages="))?.split("=")[1] ?? "25");
// Sequential, not concurrent: a handful of parallel requests silently got
// empty/bot-walled responses in testing (2026-09-28) while every one of the
// same URLs succeeded when fetched one at a time — Tamda's origin looks like
// it rate-limits concurrent connections from one IP.
//
// Sequential alone wasn't enough either: a real 25-pages×11-categories run
// the same day got throttled PARTWAY THROUGH (3 whole categories silently
// came back with zero products, while the same URLs worked fine seconds
// after the run finished) even at 400ms between requests with no
// concurrency at all — so this looks like a sustained-rate limit, not just
// an anti-burst one. RETRY_ON_EMPTY treats "200 OK but zero products" on a
// known-real category as a rate-limit symptom (these categories never
// actually have zero listings) and backs off hard before retrying, rather
// than trusting a suspicious empty result.
const REQUEST_DELAY_MS = 700;
const RETRY_BACKOFF_MS = 8000;
const MAX_RETRIES = 2;
const USER_AGENT = "Mozilla/5.0 (compatible; GotridPerfumeStockCheck/1.0)";

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// The ~11 top-level Drogerie tabs that together cover every category label
// the three prior import batches (import-tamda.ts, import-tamda-batch2.ts,
// import-tamda-autokosmetika.ts) ever mapped — skin/hair/oral/body/nail
// care, shaving, feminine care, condoms/pregnancy/massage gels, candles,
// air fresheners, car cosmetics. Deliberately excludes the rest of Tamda's
// catalog (groceries, drinks, toys, cleaning products, tobacco, …) which
// isn't this store's category.
const CATEGORY_SLUGS = [
  "skin-care-vi",
  "hair-care-vi",
  "oral-care-vi",
  "shaving-vi",
  "nails-care-vi",
  "feminine-care-vi",
  "condom-pregnancy-test-massage-gels-vi",
  "body-care-vi",
  "car-cosmetics-vi",
  "candles-vi",
  "air-freshener-vi",
];

async function fetchPage(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, { headers: { "User-Agent": USER_AGENT } });
    if (!res.ok) return null;
    return await res.text();
  } catch {
    return null;
  }
}

// Category grid cards render `data-product-id="ID"` and, separately, the
// product's own link as `<span class="product-title"><a href="URL">` — both
// appear exactly once per card and in the same document order (verified
// 2026-09-28: 66 of each on a 66-product page), so zipping the two id-order
// lists together gives a reliable id→url pairing without needing a second
// lookup request per candidate (an earlier version of this script tried
// resolving id→url via Tamda's own search box — search.html does NOT match
// internal product IDs, only names/EANs/barcodes, so that returned nothing
// for every single candidate).
function extractProductIdUrlPairs(html: string): Map<string, string> {
  const ids = [...html.matchAll(/data-product-id="(\d+)"/g)].map((m) => m[1]);
  const urls = [...html.matchAll(/class="product-title">\s*<a href="([^"]+)"/g)].map((m) => m[1]);
  const pairs = new Map<string, string>();
  const n = Math.min(ids.length, urls.length);
  for (let i = 0; i < n; i++) pairs.set(ids[i], urls[i]);
  return pairs;
}

// Fetches one page, retrying with a long backoff if it comes back looking
// rate-limited (200 OK but zero products — see RETRY_BACKOFF_MS above).
// Returns whatever it last got, even an empty map, once retries are spent.
async function fetchPageWithRetry(url: string): Promise<Map<string, string>> {
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    const html = await fetchPage(url);
    const pairs = html ? extractProductIdUrlPairs(html) : new Map<string, string>();
    if (pairs.size > 0 || attempt === MAX_RETRIES) return pairs;
    console.warn(`    [rate-limit suspected] ${url} came back empty, backing off ${RETRY_BACKOFF_MS}ms (attempt ${attempt + 1}/${MAX_RETRIES + 1})`);
    await sleep(RETRY_BACKOFF_MS);
  }
  return new Map();
}

async function discoverCategory(slug: string): Promise<Map<string, string>> {
  const found = new Map<string, string>();
  const urls = [`https://tamdaexpress.eu/${slug}.html`];
  for (let p = 2; p <= PAGES_PER_CATEGORY; p++) {
    urls.push(`https://tamdaexpress.eu/${slug}-page-${p}.html`);
  }

  for (const url of urls) {
    const pagePairs = await fetchPageWithRetry(url);
    for (const [id, productUrl] of pagePairs) found.set(id, productUrl);
    await sleep(REQUEST_DELAY_MS);
  }
  return found;
}

interface Candidate {
  tamdaId: string;
  name: string | null;
  ean: string | null;
  breadcrumb: string | null;
  url: string | null;
}

async function fetchCandidateDetails(tamdaId: string, productUrl: string): Promise<Candidate> {
  let productHtml: string | null = null;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    productHtml = await fetchPage(productUrl);
    if (productHtml) break;
    if (attempt < MAX_RETRIES) await sleep(RETRY_BACKOFF_MS);
  }
  if (!productHtml) return { tamdaId, name: null, ean: null, breadcrumb: null, url: productUrl };

  // <h1> wraps its text in a further <bdi> tag with no useful attributes to
  // anchor on, so <title> (always plain text, always "<Name>" with no
  // suffix on this site) is the reliable source. EAN sits several tags away
  // from the literal word ("EAN</em></span><span><em>12345</em>"), not the
  // 20-char gap assumed in an earlier version of this regex. Breadcrumbs are
  // a div (class "ty-breadcrumbs"), not a <nav> — confirmed 2026-09-29 by
  // reading a real product page's markup directly.
  const nameMatch = productHtml.match(/<title>([^<]+)<\/title>/);
  const eanMatch = productHtml.match(/EAN\D{0,80}?(\d{8,14})/);
  const breadcrumbMatch = productHtml.match(/<div class="ty-breadcrumbs[^"]*">([\s\S]{0,1500}?)<\/div>/);
  const breadcrumb = breadcrumbMatch
    ? breadcrumbMatch[1].replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim()
    : null;

  return {
    tamdaId,
    name: nameMatch ? nameMatch[1].trim() : null,
    ean: eanMatch ? eanMatch[1] : null,
    breadcrumb,
    url: productUrl,
  };
}

async function main() {
  console.log(`Discovering products across ${CATEGORY_SLUGS.length} categories (${PAGES_PER_CATEGORY} page fetches each)...`);

  const allDiscovered = new Map<string, string>();
  for (const slug of CATEGORY_SLUGS) {
    const found = await discoverCategory(slug);
    console.log(`  ${slug}: ${found.size} unique product IDs seen`);
    for (const [id, url] of found) allDiscovered.set(id, url);
  }
  console.log(`\nTotal unique product IDs discovered: ${allDiscovered.size}`);

  const existing = await prisma.product.findMany({
    where: { code: { startsWith: "TDE-" } },
    select: { code: true },
  });
  const existingIds = new Set(existing.map((p) => p.code.replace("TDE-", "")));

  const newEntries = [...allDiscovered].filter(([id]) => !existingIds.has(id));
  console.log(`Already in our catalog: ${allDiscovered.size - newEntries.length}`);
  console.log(`Candidates not yet in our catalog: ${newEntries.length}`);

  if (newEntries.length === 0) {
    console.log("\nNothing new this run.");
    return;
  }

  console.log("\nFetching details for candidates (one request per candidate — we already have its URL)...");
  const candidates: Candidate[] = [];
  for (let i = 0; i < newEntries.length; i++) {
    const [id, url] = newEntries[i];
    candidates.push(await fetchCandidateDetails(id, url));
    await sleep(REQUEST_DELAY_MS);
    if ((i + 1) % 4 === 0 || i === newEntries.length - 1) {
      console.log(`  ${i + 1}/${newEntries.length}`);
    }
  }

  const dateStr = new Date().toISOString().slice(0, 10);
  const outPath = `scripts/tamda-data/new-candidates-${dateStr}.json`;
  writeFileSync(outPath, JSON.stringify(candidates, null, 2));
  console.log(`\nWrote ${candidates.length} candidates to ${outPath}`);
  console.log(
    "Next step: build a CSV of these EANs and run it through Tamda's own " +
      '"Objednávka z CSV" tool (needs login) to get live stock/price before importing — ' +
      "same process used for the 2026-09-28 backlog and \"Product New\" imports.",
  );
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
