import { prisma } from "../../src/lib/prisma";
async function main(){
  const k = await prisma.category.findUnique({where:{fullSlug:"kosmetika/korejska-kosmetika"},select:{id:true}});
  const ps = await prisma.product.findMany({where:{visible:true,categories:{some:{categoryId:k!.id}}},select:{code:true,name:true,salesCount:true,price:true,description:true,ingredients:true,brand:{select:{name:true}}}});
  const byBrand:Record<string,{n:number,sold:number,withIngr:number}>={};
  for(const p of ps){const b=p.brand?.name??"?"; const o=byBrand[b]??={n:0,sold:0,withIngr:0}; o.n++; o.sold+=p.salesCount; if(p.ingredients) o.withIngr++;}
  console.log(ps.length, Object.entries(byBrand).sort((a,b)=>b[1].sold-a[1].sold||b[1].n-a[1].n).slice(0,18).map(([b,o])=>`${b}: ${o.n} prod, ${o.sold} sold, INCI ${o.withIngr}`).join("\n"));
  const top=ps.sort((a,b)=>b.salesCount-a.salesCount).slice(0,8); console.log(top.map(p=>`${p.salesCount}x ${p.code} ${p.name.slice(0,50)} ${Number(p.price)}Kc`).join("\n"));
  const withIngr=ps.filter(p=>p.ingredients).length; const longDesc=ps.filter(p=>(p.description??"").length>600).length; console.log("INCI total",withIngr,"desc>600",longDesc);
}
main().finally(()=>prisma.$disconnect());
