import { prisma } from "../../src/lib/prisma";
async function main(){
  const eans=["8809447255286","8809447256085","8809447251400","8809447254708","8809447254203","8809447254609","8809447253152","8809447255989","8809447254708"];
  const ps=await prisma.product.findMany({where:{ean:{in:eans}},select:{code:true,ean:true,name:true,stock:true,purchasePrice:true,price:true,visible:true,description:true,images:{select:{url:true}},categories:{select:{category:{select:{fullSlug:true}}}}}});
  for(const p of ps) console.log(p.code,p.ean,p.visible,"stock",p.stock,"cost",Number(p.purchasePrice),"price",Number(p.price),"desc",p.description?.length??0,"imgs",p.images.length,p.categories.map(c=>c.category.fullSlug).join(","),"|",p.name.slice(0,70));
  // SPV Dr. Althea overall
  const dr=await prisma.product.count({where:{name:{contains:"Althea"},visible:true}}); console.log("visible Althea products:",dr);
}
main().finally(()=>prisma.$disconnect());
