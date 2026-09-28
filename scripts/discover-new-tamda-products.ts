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
// it rate-limits concurrent connections from one IP. A small delay between
// requests is cheap insurance against the same thing recurring.
const REQUEST_DELAY_MS = 400;
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

function extractProductIds(html: string): Set<string> {
  const ids = new Set<string>();
  const re = /data-product-id="(\d+)"/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) ids.add(m[1]);
  return ids;
}

async function discoverCategory(slug: string): Promise<Set<string>> {
  const ids = new Set<string>();
  const urls = [`https://tamdaexpress.eu/${slug}.html`];
  for (let p = 2; p <= PAGES_PER_CATEGORY; p++) {
    urls.push(`https://tamdaexpress.eu/${slug}-page-${p}.html`);
  }

  for (const url of urls) {
    const html = await fetchPage(url);
    if (html) {
      for (const id of extractProductIds(html)) ids.add(id);
    }
    await sleep(REQUEST_DELAY_MS);
  }
  return ids;
}

interface Candidate {
  tamdaId: string;
  name: string | null;
  ean: string | null;
  breadcrumb: string | null;
  url: string | null;
}

async function fetchCandidateDetails(tamdaId: string): Promise<Candidate> {
  // Product URLs are slugged, not ID-based, so there's no direct /product/{id}
  // route — but Tamda's search-by-code also matches internal IDs, same as it
  // matches EAN/barcode (confirmed 2026-09-28 via the storefront search box).
  const html = await fetchPage(`https://tamdaexpress.eu/search.html?search_performed=Y&q=${tamdaId}`);
  if (!html) return { tamdaId, name: null, ean: null, breadcrumb: null, url: null };

  const linkMatch = html.match(new RegExp(`<a[^>]*href="(https://tamdaexpress\\.eu/[a-z0-9-]+\\.html)"[^>]*>[^<]*</a>[^]{0,20}data-product-id="${tamdaId}"`));
  const productUrl = linkMatch ? linkMatch[1] : null;
  if (!productUrl) return { tamdaId, name: null, ean: null, breadcrumb: null, url: null };

  const productHtml = await fetchPage(productUrl);
  if (!productHtml) return { tamdaId, name: null, ean: null, breadcrumb: null, url: productUrl };

  const nameMatch = productHtml.match(/<h1[^>]*>([^<]+)<\/h1>/);
  const eanMatch = productHtml.match(/EAN\D{0,20}(\d{8,14})/);
  const breadcrumbMatch = productHtml.match(/<nav[^>]*breadcrumb[^>]*>([\s\S]{0,500}?)<\/nav>/i);
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

  const allDiscovered = new Set<string>();
  for (const slug of CATEGORY_SLUGS) {
    const ids = await discoverCategory(slug);
    console.log(`  ${slug}: ${ids.size} unique product IDs seen`);
    for (const id of ids) allDiscovered.add(id);
  }
  console.log(`\nTotal unique product IDs discovered: ${allDiscovered.size}`);

  const existing = await prisma.product.findMany({
    where: { code: { startsWith: "TDE-" } },
    select: { code: true },
  });
  const existingIds = new Set(existing.map((p) => p.code.replace("TDE-", "")));

  const newIds = [...allDiscovered].filter((id) => !existingIds.has(id));
  console.log(`Already in our catalog: ${allDiscovered.size - newIds.length}`);
  console.log(`Candidates not yet in our catalog: ${newIds.length}`);

  if (newIds.length === 0) {
    console.log("\nNothing new this run.");
    return;
  }

  console.log("\nFetching details for candidates (this hits their site twice per candidate, be patient)...");
  const candidates: Candidate[] = [];
  for (let i = 0; i < newIds.length; i++) {
    candidates.push(await fetchCandidateDetails(newIds[i]));
    await sleep(REQUEST_DELAY_MS);
    if ((i + 1) % 4 === 0 || i === newIds.length - 1) {
      console.log(`  ${i + 1}/${newIds.length}`);
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
