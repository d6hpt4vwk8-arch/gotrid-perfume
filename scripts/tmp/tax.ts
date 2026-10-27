import { prisma } from "../../src/lib/prisma";
async function main(){
  const k = await prisma.category.findUnique({where:{fullSlug:"kosmetika/korejska-kosmetika"},select:{id:true}});
  const base={visible:true,categories:{some:{categoryId:k!.id}}};
  const cons=await prisma.concern.findMany({select:{name:true,slug:true,_count:{select:{products:true}}}});
  for(const c of cons){ const n=await prisma.product.count({where:{...base,concerns:{some:{concern:{slug:c.slug}}}}}); console.log("concern",c.slug,c.name,"K-beauty:",n); }
  const sts=await prisma.skinType.findMany({select:{name:true,slug:true}});
  for(const s of sts){ const n=await prisma.product.count({where:{...base,skinTypes:{some:{skinType:{slug:s.slug}}}}}); console.log("skin",s.slug,s.name,"K-beauty:",n); }
  const tot=await prisma.product.count({where:base}); console.log("total",tot);
}
main().finally(()=>prisma.$disconnect());
