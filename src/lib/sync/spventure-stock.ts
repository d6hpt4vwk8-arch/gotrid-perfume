// Syncs our stock numbers for SP Venture (perfumes-b2b.com) products against
// their live product.xml feed. Runs daily via Vercel Cron
// (src/app/api/cron/sync-spventure-stock/route.ts) and can also be run by
// hand via scripts/sync-spventure-stock.ts.
//
// Important quirk of SP Venture's feed (verified 2026-08-16 by diffing
// product.xml against avail.xml): BOTH feeds only ever list items with
// stock > 0 — an item with zero stock right now is indistinguishable from
// one permanently discontinued; the feed simply omits it either way.
// The storefront already renders "Vyprodáno" + a stock-alert signup for
// stock 0, which is the correct behavior for a transient supplier
// stockout; permanently hiding a product that's been gone for a long time
// is a separate, human judgment call, not something a single feed
// snapshot should decide.
//
// The one exception (2026-09-04): stock === 1 specifically is auto-hidden
// (and auto-restored once restocked above 1) — see the comment above
// `desiredVisible` below for why.
//
// BUT (found 2026-08-25): "missing from the feed" does NOT reliably mean
// "stock 0". The feed carries 5254 items while SP Venture's own site
// reports 6399 in stock, and spot-checking 25 codes the feed omitted found
// 9 of them (36%) actually in stock — some in quantity (348, 81, 54 ks).
// Zeroing on absence alone would therefore have wrongly marked roughly a
// third of those products sold out. So anything missing from the feed is
// now confirmed one-by-one against the supplier's own search page, which
// states availability exactly ("27 ks" / "Momentálně nedostupné") and
// needs no login. A lookup that fails or comes back ambiguous leaves the
// stock untouched rather than guessing in either direction.
import { prisma } from "@/lib/prisma";
import { logAdminActivity } from "@/lib/admin/activity-log";
import { notifyStockAlerts } from "@/lib/stock-alerts";

// ?cy=czk pinned explicitly (SP Venture's own feed-customization docs, ISO
// 4217) rather than relying on whatever their default happens to be — we
// only read STOCK here so currency doesn't actually affect this sync, but
// pinning it keeps this URL self-documenting and matches the price feed.
const FEED_URL =
  "https://www.perfumes-b2b.com/exchange/06560451-31AA-4C08-9B66-C149E1FF95DB/xml/product.xml?cy=czk";
const CODE_PREFIX = "SPV-";

function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'");
}

function extractTag(block: string, tag: string): string {
  const match = new RegExp(`<${tag}>([\\s\\S]*?)<\\/${tag}>`).exec(block);
  return match ? decodeEntities(match[1].trim()) : "";
}

function parseStockByCode(xml: string): Map<string, number> {
  const blocks = xml.split("<SHOPITEM>").slice(1);
  const byCode = new Map<string, number>();
  for (const raw of blocks) {
    const block = raw.split("</SHOPITEM>")[0];
    const itemCode = extractTag(block, "ITEM_CODE");
    if (!itemCode) continue;
    const stockRaw = extractTag(block, "STOCK");
    byCode.set(itemCode, stockRaw ? parseInt(stockRaw, 10) : 0);
  }
  return byCode;
}

// Public search page — same numbers as the logged-in B2B view, no session
// needed. Availability renders as aria-label="Dostupnost: 27 ks", or the
// literal "Momentálně nedostupné" (HTML-entity encoded) when sold out.
const SEARCH_URL = "https://www.perfumes-b2b.com/cz/hledat/?q=";
const LOOKUP_CONCURRENCY = 6;

/**
 * Confirms one feed-missing code against SP Venture's own search page.
 * Returns the exact stock, or null when the answer isn't unambiguous (search
 * error, no/multiple hits) — callers must leave stock untouched on null
 * rather than assuming zero.
 */
async function lookupStockOnSite(itemCode: string): Promise<number | null> {
  let html: string;
  try {
    const res = await fetch(`${SEARCH_URL}${encodeURIComponent(itemCode)}`, {
      signal: AbortSignal.timeout(20_000),
    });
    if (!res.ok) return null;
    html = (await res.text()).replace(/\n/g, " ");
  } catch {
    return null;
  }

  // Only trust a search that resolved to exactly one product — a partial
  // code match returning several rows tells us nothing about this one.
  const count = /nalezli celkem\s*<span>(\d+)/.exec(html);
  if (!count || count[1] !== "1") return null;

  const inStock = /aria-label="Dostupnost:\s*(\d+)\s*ks"/.exec(html);
  if (inStock) return parseInt(inStock[1], 10);
  if (html.includes("nedostupn")) return 0;
  return null;
}

/** Runs lookupStockOnSite over many codes with a small connection pool. */
async function lookupMissingCodes(codes: string[]): Promise<Map<string, number>> {
  const found = new Map<string, number>();
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(LOOKUP_CONCURRENCY, codes.length) }, async () => {
      while (next < codes.length) {
        const code = codes[next++];
        const stock = await lookupStockOnSite(code);
        if (stock !== null) found.set(code, stock);
      }
    }),
  );
  return found;
}

export interface SpVentureSyncResult {
  checked: number;
  updated: { code: string; name: string; from: number; to: number }[];
  /** Feed-missing codes the site lookup couldn't resolve — left untouched. */
  unresolved: number;
}

export async function syncSpVentureStock(dryRun = false): Promise<SpVentureSyncResult> {
  const res = await fetch(FEED_URL);
  if (!res.ok) throw new Error(`SP Venture feed fetch failed: ${res.status}`);
  const xml = await res.text();
  const feedStock = parseStockByCode(xml);

  const products = await prisma.product.findMany({
    where: { code: { startsWith: CODE_PREFIX } },
  });

  // Anything the feed omits gets confirmed against the site before we touch
  // it (see the header note) — the feed's silence is not evidence of zero.
  const missingCodes = products
    .map((p) => p.code.slice(CODE_PREFIX.length))
    .filter((code) => !feedStock.has(code));
  const siteStock = await lookupMissingCodes(missingCodes);

  const result: SpVentureSyncResult = {
    checked: products.length,
    updated: [],
    unresolved: missingCodes.length - siteStock.size,
  };

  for (const product of products) {
    const itemCode = product.code.slice(CODE_PREFIX.length);
    const feedValue = feedStock.get(itemCode) ?? siteStock.get(itemCode);
    // Feed didn't list it and the site lookup was inconclusive — leave the
    // current number alone instead of guessing.
    if (feedValue === undefined) continue;

    // We only buy SPV stock from the supplier after a customer orders, not
    // ahead of time — a product down to their last unit has a real chance
    // of being sold out at SP Venture by the time we go buy it, so it's not
    // worth advertising. Hide at stock 1, restore automatically once it's
    // restocked above that (2026-09-04, per owner request).
    const desiredVisible =
      feedValue === 1 ? false : feedValue > 1 && product.stock <= 1 ? true : product.visible;
    const stockChanged = feedValue !== product.stock;
    const visibilityChanged = desiredVisible !== product.visible;
    if (!stockChanged && !visibilityChanged) continue;

    if (stockChanged) {
      result.updated.push({ code: product.code, name: product.name, from: product.stock, to: feedValue });
    }
    if (!dryRun) {
      const updated = await prisma.product.update({
        where: { id: product.id },
        data: { stock: feedValue, visible: desiredVisible },
      });
      if (product.stock <= 0 && feedValue > 0) {
        void notifyStockAlerts(updated).catch((err) =>
          console.error(`[spventure-sync] stock-alert notify failed for ${product.code}`, err),
        );
      }
    }
  }

  if (!dryRun && result.updated.length > 0) {
    const wentToZero = result.updated.filter((u) => u.to === 0).length;
    const wentUp = result.updated.length - wentToZero;
    await logAdminActivity({
      action: "product.spventure_sync",
      entityType: "Product",
      detail: `SP Venture stock sync: ${result.updated.length} updated (${wentUp} restocked/changed, ${wentToZero} now at 0), ${result.unresolved} unresolved`,
    });
  }

  return result;
}
