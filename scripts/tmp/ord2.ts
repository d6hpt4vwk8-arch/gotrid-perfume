import { prisma } from "../../src/lib/prisma";
async function main(){
  for (const n of ["GT261019-1064","GT261019-0340"]) {
    const o:any = await prisma.order.findFirst({ where:{ number:n }, include:{ items:{ include:{ product:{ select:{ code:true, name:true, stock:true, ownStock:true, visible:true } } } } } });
    console.log(n, o.status, "tracking:", o.trackingNumber ?? o.glsParcelNumber ?? null, "shippedAt:", o.shippedAt ?? null);
    for (const i of o.items) console.log("  ", i.quantity, i.product?.code, "stock", i.product?.stock, "own", i.product?.ownStock, "visible", i.product?.visible, (i.product?.name??"").slice(0,50));
  }
}
main().finally(()=>prisma.$disconnect());
