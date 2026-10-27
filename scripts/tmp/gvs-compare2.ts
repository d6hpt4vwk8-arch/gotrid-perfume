import { readFile } from "node:fs/promises";
import { prisma } from "../../src/lib/prisma";
async function main() {
  const rows = JSON.parse(await readFile("ops/gvs-new-2026-10-22.json", "utf-8")) as any[];
  const prods = await prisma.product.findMany({ where: { code: { startsWith: "GVS-" } }, select: { code: true, ean: true, name: true, stock: true, purchasePrice: true, price: true, visible: true, isDefective: true } });
  const vis0 = prods.filter(p=>p.visible&&p.stock===0&&!p.isDefective).length;
  console.log("visible with stock0 (non-defect):", vis0, "visible stock>0:", prods.filter(p=>p.visible&&p.stock>0).length, "hidden:", prods.filter(p=>!p.visible).map(p=>p.code+":"+p.stock).join(","));
  console.log("DEFECT in DB:"); prods.filter(p=>p.isDefective).forEach(p=>console.log(p.code,p.ean,p.stock,Number(p.purchasePrice),Number(p.price),p.visible,p.name.slice(0,60)));
  console.log("DEFECT sheet:"); rows.filter(r=>r.sheet==="Defective Items").forEach(r=>console.log(r.art,Math.round(r.ean),r.avail,r.czk,r.name.slice(0,60)));
  // regular cost compare using max czk per EAN
  const g=new Map<string,any[]>(); rows.filter(r=>r.sheet!=="Defective Items").forEach(r=>{const k=String(Math.round(Number(r.ean)));const a=g.get(k)??[];a.push(r);g.set(k,a);});
  console.log("REGULAR COST DIFFS");
  for(const p of prods){ if(p.isDefective||!p.ean) continue; const rs=g.get(p.ean); if(!rs) continue; const reg=Math.max(...rs.map(r=>Number(r.czk)||0)); const cheap=rs.filter(r=>r.avail==="in stock"&&Number(r.czk)&&Number(r.czk)<reg*0.8).map(r=>r.czk+"("+r.info+")"); const disc=rs.find(r=>r.disc)?.disc; if(Math.abs(Number(p.purchasePrice)-reg)>1) console.log(p.code,p.name.slice(0,38),"db",Number(p.purchasePrice),"sheet",reg,disc?"disc "+disc:"", "sell",Number(p.price), cheap.length?"CHEAP "+cheap.join(","):""); else if(cheap.length) console.log("  cheap-batch:",p.code,p.name.slice(0,38),"reg",reg,cheap.join(","));
  }
}
main().finally(()=>prisma.$disconnect());
