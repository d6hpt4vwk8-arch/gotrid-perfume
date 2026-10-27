import { prisma } from "../../src/lib/prisma";
async function main(){
  const ps=await prisma.product.findMany({where:{brand:{name:"VVBETTER"}},select:{code:true,name:true,stock:true,ownStock:true,visible:true,isDefective:true,purchasePrice:true,price:true,compareAtPrice:true,salesCount:true,ean:true},orderBy:{code:"asc"}});
  ps.forEach(p=>console.log(p.code.padEnd(20),String(p.stock).padStart(3),"own",p.ownStock,p.visible?"V":"-",p.isDefective?"D":" ","cost",Number(p.purchasePrice),"price",Number(p.price),"cmp",p.compareAtPrice?Number(p.compareAtPrice):"","sold",p.salesCount,p.name.slice(0,52)));
}
main().finally(()=>prisma.$disconnect());
