// Syncs our stock, purchase price, and "slowerDelivery" flag for SP Venture
// (perfumes-b2b.com) products against their live product.xml feed. Runs
// daily via Vercel Cron (src/app/api/cron/sync-spventure-stock/route.ts)
// and can also be run by hand via scripts/sync-spventure-stock.ts.
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
// Same markup the import uses (scripts/import-spventure.ts: wholesale × 1.21
// VAT × 1.2). Doubles as the price FLOOR: when SP Venture raises a wholesale
// price the sell price used to stay frozen at import time, so 20 products were
// on sale below what they cost us (found 2026-10-08, e.g. a gift box sold at
// 700 and bought in at 1 000). The sync now lifts the sell price back up to
// this level whenever the feed shows a higher wholesale price. It only ever
// raises — a lower wholesale price doesn't auto-discount anything.
const VAT_FACTOR = 1.21;
const MARKUP = 1.2;
// Prices within this share of the floor are left alone — import rounding and
// small manual tweaks, not a stale price.
const FLOOR_TOLERANCE = 0.97;

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

interface FeedEntry {
  stock: number;
  /** The feed's <PRICE> for this code, or null when the tag was missing/unparseable. */
  price: number | null;
}

function parseFeedByCode(xml: string): Map<string, FeedEntry> {
  const blocks = xml.split("<SHOPITEM>").slice(1);
  const byCode = new Map<string, FeedEntry>();
  for (const raw of blocks) {
    const block = raw.split("</SHOPITEM>")[0];
    const itemCode = extractTag(block, "ITEM_CODE");
    if (!itemCode) continue;
    const stockRaw = extractTag(block, "STOCK");
    const priceRaw = extractTag(block, "PRICE");
    const price = priceRaw ? parseFloat(priceRaw) : NaN;
    byCode.set(itemCode, {
      stock: stockRaw ? parseInt(stockRaw, 10) : 0,
      price: Number.isFinite(price) ? price : null,
    });
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
  /** Sell prices lifted to the cost floor (see MARKUP above). */
  priceRaised: { code: string; name: string; from: number; to: number; cost: number }[];
}

export async function syncSpVentureStock(dryRun = false): Promise<SpVentureSyncResult> {
  const res = await fetch(FEED_URL);
  if (!res.ok) throw new Error(`SP Venture feed fetch failed: ${res.status}`);
  const xml = await res.text();
  const feed = parseFeedByCode(xml);

  const products = await prisma.product.findMany({
    where: { code: { startsWith: CODE_PREFIX } },
  });

  // Anything the feed omits gets confirmed against the site before we touch
  // it (see the header note) — the feed's silence is not evidence of zero.
  const missingCodes = products
    .map((p) => p.code.slice(CODE_PREFIX.length))
    .filter((code) => !feed.has(code));
  const siteStock = await lookupMissingCodes(missingCodes);

  const result: SpVentureSyncResult = {
    checked: products.length,
    updated: [],
    unresolved: missingCodes.length - siteStock.size,
    priceRaised: [],
  };

  for (const product of products) {
    const itemCode = product.code.slice(CODE_PREFIX.length);
    const feedEntry = feed.get(itemCode);
    const supplierValue = feedEntry?.stock ?? siteStock.get(itemCode);
    // Feed didn't list it and the site lookup was inconclusive — leave the
    // current number alone instead of guessing.
    if (supplierValue === undefined) continue;
    // Goods we hold ourselves stay sellable whatever the supplier says (owner's
    // rule, 2026-10-09): the storefront gates availability on `stock` alone,
    // so the supplier number is never allowed to push it below our own units.
    const feedValue = Math.max(supplierValue, product.ownStock);

    // Found in SP Venture's own feed = sitting in their main warehouse and
    // priced accurately right now; found only via the public site search =
    // confirmed 2026-09-27 (a customer's order for a feed-missing code
    // couldn't be found through the account's own search either, though the
    // anonymous site search showed it) that this class of product tends to
    // ship from elsewhere and take noticeably longer — flagged for the
    // customer via `slowerDelivery` rather than silently promising normal
    // delivery. Cleared automatically once the code is back in the feed.
    const slowerDelivery = !feedEntry;

    // We only buy SPV stock from the supplier after a customer orders, not
    // ahead of time — a product down to their last unit has a real chance
    // of being sold out at SP Venture by the time we go buy it, so it's not
    // worth advertising. Hide at stock 1, restore automatically once it's
    // restocked above that (2026-09-04, per owner request).
    // Own units are real in-hand stock, not a drop-ship gamble — never auto-hide those.
    const desiredVisible =
      product.ownStock > 0
        ? product.visible
        : feedValue === 1
          ? false
          : feedValue > 1 && product.stock <= 1
            ? true
            : product.visible;

    // The feed's PRICE is the only place we ever learn SP Venture's current
    // wholesale price after initial import — this sync previously touched
    // stock/visible only, so purchasePrice silently went stale forever
    // (found 2026-09-27: a lip balm bought in at ~40 Kč was actually 87 Kč
    // by the time it needed reordering). Only applied when the feed lists
    // the code — a site-lookup-only hit gives us no price at all.
    const feedPrice = feedEntry?.price ?? null;
    const priceChanged = feedPrice !== null && feedPrice !== Number(product.purchasePrice);

    // Price floor, from the freshest wholesale price we know: the feed's when
    // it lists the code, otherwise what we stored last time.
    const wholesale = feedPrice ?? Number(product.purchasePrice);
    const floorPrice = wholesale > 0 ? Math.round(wholesale * VAT_FACTOR * MARKUP) : 0;
    // Units we hold ourselves (ownStock) were bought at their own cost, which
    // this wholesale-based floor knows nothing about — the owner prices those
    // by hand (e.g. the Club De Nuit Blue Iconic 200 ml at 1 200), so leave them.
    const sellPriceTooLow = floorPrice > 0 && product.ownStock === 0 && Number(product.price) < floorPrice * FLOOR_TOLERANCE;
    // A "was" price that is no longer above the sell price would show a
    // nonsensical strike-through — drop it when we raise the price past it.
    const dropCompareAt = sellPriceTooLow && product.compareAtPrice !== null && Number(product.compareAtPrice) <= floorPrice;

    const stockChanged = feedValue !== product.stock;
    const visibilityChanged = desiredVisible !== product.visible;
    const slowerDeliveryChanged = slowerDelivery !== product.slowerDelivery;
    if (!stockChanged && !visibilityChanged && !priceChanged && !slowerDeliveryChanged && !sellPriceTooLow) continue;

    if (sellPriceTooLow) {
      result.priceRaised.push({
        code: product.code,
        name: product.name,
        from: Number(product.price),
        to: floorPrice,
        cost: Math.round(wholesale * VAT_FACTOR * 100) / 100,
      });
    }

    if (stockChanged) {
      result.updated.push({ code: product.code, name: product.name, from: product.stock, to: feedValue });
    }
    if (!dryRun) {
      const updated = await prisma.product.update({
        where: { id: product.id },
        data: {
          stock: feedValue,
          visible: desiredVisible,
          slowerDelivery,
          ...(feedPrice !== null ? { purchasePrice: feedPrice } : {}),
          ...(sellPriceTooLow ? { price: floorPrice, ...(dropCompareAt ? { compareAtPrice: null } : {}) } : {}),
        },
      });
      if (product.stock <= 0 && feedValue > 0) {
        void notifyStockAlerts(updated).catch((err) =>
          console.error(`[spventure-sync] stock-alert notify failed for ${product.code}`, err),
        );
      }
    }
  }

  if (!dryRun && result.priceRaised.length > 0) {
    await logAdminActivity({
      action: "product.spventure_price_floor",
      entityType: "Product",
      detail: `SP Venture price floor: ${result.priceRaised.length} sell prices raised to wholesale × 1.21 × 1.2 (${result.priceRaised
        .slice(0, 5)
        .map((r) => `${r.code} ${r.from}→${r.to}`)
        .join(", ")}${result.priceRaised.length > 5 ? ", …" : ""})`,
    });
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
