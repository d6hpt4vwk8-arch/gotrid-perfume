import { prisma } from "../../src/lib/prisma";
async function main(){
  for (const n of ["GT261019-1064","GT261019-0340"]) {
    const o:any = await prisma.order.findFirst({ where:{ number:n }, include:{ items:true } });
    if(!o){ console.log(n,"NOT FOUND"); continue; }
    const {items, ...rest} = o;
    console.log(n, JSON.stringify(Object.fromEntries(Object.entries(rest).filter(([k,v])=>v!==null && !/address|street|phone|note/i.test(k) ) ),null,0).slice(0,1400));
    console.log(" items:", items.map((i:any)=>`${i.quantity}x ${i.name||i.productName||i.productId}`).join("; "));
  }
}
main().finally(()=>prisma.$disconnect());
