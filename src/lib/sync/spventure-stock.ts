// Syncs our stock numbers for SP Venture (perfumes-b2b.com) products against
// their live product.xml feed. Runs daily via Vercel Cron
// (src/app/api/cron/sync-spventure-stock/route.ts) and can also be run by
// hand via scripts/sync-spventure-stock.ts.
//
// Important quirk of SP Venture's feed (verified 2026-08-16 by diffing
// product.xml against avail.xml): BOTH feeds only ever list items with
// stock > 0 — an item with zero stock right now is indistinguishable from
// one permanently discontinued; the feed simply omits it either way. So a
// missing code here just means "stock is 0 right now", nothing stronger —
// this only ever writes the `stock` number, it never touches `visible`.
// The storefront already renders "Vyprodáno" + a stock-alert signup for
// stock 0, which is the correct behavior for a transient supplier
// stockout; permanently hiding a product that's been gone for a long time
// is a separate, human judgment call, not something a single feed
// snapshot should decide.
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

export interface SpVentureSyncResult {
  checked: number;
  updated: { code: string; name: string; from: number; to: number }[];
}

export async function syncSpVentureStock(dryRun = false): Promise<SpVentureSyncResult> {
  const res = await fetch(FEED_URL);
  if (!res.ok) throw new Error(`SP Venture feed fetch failed: ${res.status}`);
  const xml = await res.text();
  const feedStock = parseStockByCode(xml);

  const products = await prisma.product.findMany({
    where: { code: { startsWith: CODE_PREFIX } },
  });

  const result: SpVentureSyncResult = { checked: products.length, updated: [] };

  for (const product of products) {
    const itemCode = product.code.slice(CODE_PREFIX.length);
    const feedValue = feedStock.get(itemCode) ?? 0;

    if (feedValue === product.stock) continue;

    result.updated.push({ code: product.code, name: product.name, from: product.stock, to: feedValue });
    if (!dryRun) {
      const updated = await prisma.product.update({
        where: { id: product.id },
        data: { stock: feedValue },
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
      detail: `SP Venture stock sync: ${result.updated.length} updated (${wentUp} restocked/changed, ${wentToZero} now at 0)`,
    });
  }

  return result;
}
