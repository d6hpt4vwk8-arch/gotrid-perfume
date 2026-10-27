import { prisma } from "../../src/lib/prisma";
async function main(){
  const d=await prisma.product.findMany({where:{code:{startsWith:"GVS-"},isDefective:true},select:{code:true,stock:true,price:true,visible:true,images:{select:{url:true}},categories:{select:{category:{select:{fullSlug:true}}}}},orderBy:{code:"asc"}});
  d.forEach(p=>console.log(p.code,p.stock,Number(p.price),p.visible,p.images.length,p.categories.map(c=>c.category.fullSlug).join(",")));
  const s=await prisma.product.findUnique({where:{code:"SPV-0247764"},select:{description:true,isVegan:true}}); console.log(s);
}
main().finally(()=>prisma.$disconnect());
