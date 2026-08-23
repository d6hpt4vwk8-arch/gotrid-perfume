// Syncs our stock numbers for perfumes-wholesale.eu (m2.znzelectronics.cz)
// products against their live stock CSV feed. Runs daily via Vercel Cron
// (bundled into src/app/api/cron/daily-tasks/route.ts — Hobby plan caps
// the number of separate cron jobs) and can also be run by hand via
// scripts/sync-perfumeswholesale-stock.ts.
//
// Same feed quirk as SP Venture's (see spventure-stock.ts): the feed only
// ever lists items currently in stock — a productNo missing from this run
// just means "stock is 0 right now", not "discontinued". This only ever
// writes the `stock` field, never `visible`.
import { prisma } from "@/lib/prisma";
import { logAdminActivity } from "@/lib/admin/activity-log";
import { notifyStockAlerts } from "@/lib/stock-alerts";

const FEED_URL =
  "https://m2.znzelectronics.cz/feeds/download/stock/hash/42e1c89c5c824e7da236367dac403678/format/csv/currency/CZK/type/default/";
const CODE_PREFIX = "PWH-";

function parseStockByProductNo(csv: string): Map<string, number> {
  const cleaned = csv.replace(/\x00/g, "").replace(/^﻿/, "");
  const lines = cleaned.split("\r\n").filter((l) => l.length > 0);
  const header = lines[0].split("\t");
  const iProductNo = header.indexOf("productNo");
  const iAvailability = header.indexOf("availability");

  const byProductNo = new Map<string, number>();
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split("\t");
    const productNo = (cols[iProductNo] ?? "").trim();
    if (!productNo) continue;
    byProductNo.set(productNo, parseInt(cols[iAvailability] ?? "0", 10) || 0);
  }
  return byProductNo;
}

export interface PerfumesWholesaleSyncResult {
  checked: number;
  updated: { code: string; name: string; from: number; to: number }[];
}

export async function syncPerfumesWholesaleStock(dryRun = false): Promise<PerfumesWholesaleSyncResult> {
  const res = await fetch(FEED_URL);
  if (!res.ok) throw new Error(`perfumes-wholesale.eu feed fetch failed: ${res.status}`);
  const csv = await res.text();
  const feedStock = parseStockByProductNo(csv);

  const products = await prisma.product.findMany({
    where: { code: { startsWith: CODE_PREFIX } },
  });

  const result: PerfumesWholesaleSyncResult = { checked: products.length, updated: [] };

  for (const product of products) {
    const productNo = product.code.slice(CODE_PREFIX.length);
    const feedValue = feedStock.get(productNo) ?? 0;

    if (feedValue === product.stock) continue;

    result.updated.push({ code: product.code, name: product.name, from: product.stock, to: feedValue });
    if (!dryRun) {
      const updated = await prisma.product.update({
        where: { id: product.id },
        data: { stock: feedValue },
      });
      if (product.stock <= 0 && feedValue > 0) {
        void notifyStockAlerts(updated).catch((err) =>
          console.error(`[perfumeswholesale-sync] stock-alert notify failed for ${product.code}`, err),
        );
      }
    }
  }

  if (!dryRun && result.updated.length > 0) {
    const wentToZero = result.updated.filter((u) => u.to === 0).length;
    const wentUp = result.updated.length - wentToZero;
    await logAdminActivity({
      action: "product.perfumeswholesale_sync",
      entityType: "Product",
      detail: `perfumes-wholesale.eu stock sync: ${result.updated.length} updated (${wentUp} restocked/changed, ${wentToZero} now at 0)`,
    });
  }

  return result;
}
