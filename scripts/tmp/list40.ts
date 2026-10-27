import { prisma } from "../../src/lib/prisma";
async function main(){
  const ps=await prisma.product.findMany({where:{visible:true,isDefective:false,stock:{gt:0},brand:{name:{in:["Dr. Althea","VVBETTER","Polatam"]}}},select:{code:true,name:true,salesCount:true,price:true,productType:true,keyIngredients:true,ingredients:true,description:true,brand:{select:{name:true}},variantGroupKey:true},orderBy:[{salesCount:"desc"},{code:"asc"}]});
  console.log(ps.length);
  ps.forEach(p=>console.log(p.code.padEnd(12),p.brand!.name.slice(0,7).padEnd(7),String(p.salesCount).padStart(2),String(Number(p.price)).padStart(4),(p.productType??"-").padEnd(8),(p.ingredients?"INCI":"    "),p.name.slice(0,70)));
}
main().finally(()=>prisma.$disconnect());
