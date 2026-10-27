import { readFile } from "node:fs/promises";
import { prisma } from "../../src/lib/prisma";
async function main() {
  const rows = JSON.parse(await readFile("ops/gvs-new-2026-10-22.json", "utf-8")) as any[];
  const prods = await prisma.product.findMany({ where: { code: { startsWith: "GVS-" } }, select: { id: true, code: true, ean: true, name: true, stock: true, ownStock: true, purchasePrice: true, price: true, visible: true, isDefective: true } });
  console.log("DB GVS products", prods.length, "visible", prods.filter(p=>p.visible).length, "defect", prods.filter(p=>p.isDefective).length);
  const byEan = new Map<string, any[]>();
  for (const p of prods) { if (!p.ean) continue; const a = byEan.get(p.ean) ?? []; a.push(p); byEan.set(p.ean, a); }
  const regular = rows.filter(r => r.sheet !== "Defective Items");
  const norm = (e:any)=> e? String(Math.round(Number(e))) : "";
  // group by ean in sheet
  const g = new Map<string, any[]>();
  for (const r of regular) { const k = norm(r.ean); const a = g.get(k) ?? []; a.push(r); g.set(k, a); }
  let newCnt=0; const newItems:any[]=[]; const stockChg:any[]=[]; const priceChg:any[]=[];
  for (const [ean, rs] of g) {
    const anyIn = rs.some(r=>r.avail==="in stock");
    const best = rs.filter(r=>r.avail==="in stock").sort((a,b)=>a.czk-b.czk)[0] ?? rs[0];
    const dbs = (byEan.get(ean) ?? []).filter(p=>!p.isDefective);
    if (!dbs.length) { newCnt++; newItems.push({ean, name:best.name, sheet:best.sheet, avail:anyIn?"in":"out", czk:best.czk, info:best.info, rrp:best.rrp}); continue; }
    for (const p of dbs) {
      const want = anyIn ? 10 : 0;
      if ((p.stock>0)!==(want>0)) stockChg.push({code:p.code, name:p.name.slice(0,45), db:p.stock, want, vis:p.visible});
      if (Math.abs(Number(p.purchasePrice)-best.czk)>0.5 && anyIn) priceChg.push({code:p.code, name:p.name.slice(0,40), dbCost:Number(p.purchasePrice), newCost:best.czk, sell:Number(p.price)});
    }
  }
  const sheetEans = new Set(g.keys());
  const missingInSheet = prods.filter(p=>!p.isDefective && p.ean && !sheetEans.has(p.ean) && p.visible);
  console.log("sheet unique EAN", g.size, "new", newCnt, "stock changes", stockChg.length, "price changes", priceChg.length, "DB visible not in sheet", missingInSheet.length);
  console.log("NEW"); newItems.forEach(x=>console.log(JSON.stringify(x)));
  console.log("STOCK"); stockChg.forEach(x=>console.log(JSON.stringify(x)));
  console.log("PRICE"); priceChg.forEach(x=>console.log(JSON.stringify(x)));
  console.log("MISSING"); missingInSheet.forEach(p=>console.log(p.code, p.name.slice(0,50), p.stock));
}
main().finally(()=>prisma.$disconnect());
