import { prisma } from "../../src/lib/prisma";
import { writeFileSync } from "node:fs";
async function main(){
  const ps=await prisma.product.findMany({where:{visible:true,isDefective:false,stock:{gt:0},brand:{name:{in:["Dr. Althea","VVBETTER","Polatam"]}}},select:{code:true,ean:true,name:true,description:true,ingredients:true,brand:{select:{name:true}},productType:true,keyIngredients:true,isVegan:true,isCrueltyFree:true,price:true},orderBy:{code:"asc"}});
  writeFileSync("/tmp/gvsx/p50.json",JSON.stringify(ps.map(p=>({...p,brand:p.brand!.name,price:Number(p.price)})),null,1));
  console.log(ps.length);
}
main().finally(()=>prisma.$disconnect());
