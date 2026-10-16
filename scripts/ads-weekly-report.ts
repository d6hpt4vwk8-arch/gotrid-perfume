// Weekly ad report (Heureka + Zboží.cz): joins ad costs from ops/ads/costs-*.json (copied from
// the portals) with our own orders by traffic source and segment, and prints break-even CPC and
// PNO against the targets in ops/ads-playbook.md.
//
// Usage: tsx scripts/ads-weekly-report.ts <costs.json> [--ship 30]
//   gross  = items total − purchase price × 1.21 (we are not a VAT payer, so purchase VAT is cost)
//   profit = gross − ads − shipping/fee allowance per order (--ship, default 30 Kč)
import { readFileSync, writeFileSync } from "node:fs";
import { prisma } from "../src/lib/prisma";

type SegCost = { clicks: number; cost: number; conversions?: number; conversionValue?: number };
type Costs = { period: { from: string; to: string }; Heureka: { segments: Record<string, SegCost> }; "Zboží.cz": { segments: Record<string, SegCost> } };

const SEGMENTS = ["parfémy", "kosmetika", "drogerie"] as const;
const channelOf = (s: string | null) => (/heureka/i.test(s ?? "") ? "Heureka" : /zbo/i.test(s ?? "") ? "Zboží.cz" : null);

async function main() {
  const file = process.argv[2];
  if (!file) throw new Error("usage: tsx scripts/ads-weekly-report.ts <costs.json> [--ship 30]");
  const shipIdx = process.argv.indexOf("--ship");
  const ship = shipIdx > 0 ? Number(process.argv[shipIdx + 1]) : 30;
  const costs: Costs = JSON.parse(readFileSync(file, "utf8"));
  const from = new Date(costs.period.from + "T00:00:00Z");
  const to = new Date(costs.period.to + "T23:59:59Z");

  const orders = await prisma.order.findMany({
    where: { createdAt: { gte: from, lte: to }, status: { notIn: ["CANCELLED", "REFUNDED"] } },
    select: { trafficSource: true, itemsTotal: true, items: { select: { qty: true, isGift: true, product: { select: { purchasePrice: true, categories: { select: { category: { select: { fullSlug: true } } } } } } } } },
  });

  type Agg = { orders: number; revenue: number; gross: number };
  const agg = new Map<string, Agg>();
  const add = (key: string, rev: number, gross: number) => { const a = agg.get(key) ?? { orders: 0, revenue: 0, gross: 0 }; a.orders++; a.revenue += rev; a.gross += gross; agg.set(key, a); };
  for (const o of orders) {
    const ch = channelOf(o.trafficSource);
    if (!ch) continue;
    const goods = o.items.filter((i) => !i.isGift);
    const rev = Number(o.itemsTotal);
    const gross = rev - goods.reduce((a, i) => a + Number(i.product?.purchasePrice ?? 0) * 1.21 * i.qty, 0);
    const slugs = goods.flatMap((i) => i.product?.categories.map((c) => c.category.fullSlug) ?? []);
    const seg = slugs.some((s) => /parfem|vune/.test(s)) ? "parfémy" : slugs.some((s) => /kosmetika|plet|vlas|telo/.test(s)) ? "kosmetika" : "drogerie";
    add(`${ch}|${seg}`, rev, gross);
    add(`${ch}|*`, rev, gross);
  }

  const lines: string[] = [];
  const out = (s = "") => { lines.push(s); console.log(s); };
  out(`# Reklama: ${costs.period.from} – ${costs.period.to}`);
  out();
  out("| Kanál | Segment | Kliky | Náklady | CPC | Obj. | Obrat | Hrubý zisk | PNO | Cíl PNO | Konverze | Max. CPC | Zisk po reklamě |");
  out("|---|---|---|---|---|---|---|---|---|---|---|---|---|");
  for (const ch of ["Heureka", "Zboží.cz"] as const) {
    let tClicks = 0, tCost = 0;
    for (const seg of SEGMENTS) {
      const c = costs[ch].segments[seg];
      const a = agg.get(`${ch}|${seg}`) ?? { orders: 0, revenue: 0, gross: 0 };
      if (!c) continue;
      tClicks += c.clicks; tCost += c.cost;
      const marginPct = a.revenue > 0 ? a.gross / a.revenue : 0;
      const targetPno = marginPct * 0.6;
      const pno = a.revenue > 0 ? c.cost / a.revenue : NaN;
      const conv = c.clicks > 0 ? a.orders / c.clicks : 0;
      const grossPerOrder = a.orders > 0 ? (a.gross - ship * a.orders) / a.orders : 0;
      const breakEven = grossPerOrder * conv;
      const profit = a.gross - c.cost - ship * a.orders;
      out(`| ${ch} | ${seg} | ${c.clicks} | ${c.cost} | ${(c.cost / c.clicks).toFixed(2)} | ${a.orders} | ${Math.round(a.revenue)} | ${Math.round(a.gross)} | ${Number.isFinite(pno) ? (pno * 100).toFixed(0) + " %" : "–"} | ${(targetPno * 100).toFixed(0)} % | ${(conv * 100).toFixed(1)} % | ${breakEven.toFixed(2)} | ${Math.round(profit)} |`);
    }
    const t = agg.get(`${ch}|*`) ?? { orders: 0, revenue: 0, gross: 0 };
    const other = costs[ch].segments["ostatní"];
    if (other) { tClicks += other.clicks; tCost += other.cost; }
    out(`| **${ch} celkem** | | ${tClicks} | ${tCost} | ${(tCost / tClicks).toFixed(2)} | ${t.orders} | ${Math.round(t.revenue)} | ${Math.round(t.gross)} | ${t.revenue ? ((tCost / t.revenue) * 100).toFixed(0) + " %" : "–"} | | | | **${Math.round(t.gross - tCost - ship * t.orders)}** |`);
  }
  out();
  out(`Hrubý zisk = obrat − nákup×1,21 (neplátce DPH); zisk po reklamě odečítá i ${ship} Kč/obj. na dopravu a poplatky. Objednávky podle zdroje (referrer) v naší DB, ne podle portálů; Zboží zahrnuje i neplacené zobrazení. "Max. CPC" = hrubý zisk na objednávku po dopravě × konverze kliku — nad touto cenou se klik nevyplácí.`);
  writeFileSync(`ops/reports/ads-${costs.period.to}.md`, lines.join("\n") + "\n");
}
main().finally(() => prisma.$disconnect());
