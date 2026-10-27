import { prisma } from "../src/lib/prisma";
import { writeFileSync } from "node:fs";
const tl=(h:string|null)=>(h??"").replace(/<[^>]+>/g," ").replace(/\s+/g," ").trim().length;
async function main(){
  const cats=await prisma.category.findMany({select:{id:true,fullSlug:true,name:true}});
  const root=cats.filter(c=>!c.fullSlug.includes("/")); console.log("roots:",root.map(r=>r.fullSlug).join(", "));
  const ps=await prisma.product.findMany({where:{visible:true},select:{id:true,code:true,name:true,description:true,stock:true,ownStock:true,salesCount:true,brand:{select:{name:true}},images:{select:{id:true}},categories:{select:{category:{select:{fullSlug:true}}}}}});
  const isPerf=(p:any)=>p.categories.some((c:any)=>c.category.fullSlug.startsWith("parfemy"));
  const rest=ps.filter(p=>!isPerf(p));
  console.log("visible total",ps.length,"non-perfume",rest.length);
  const top:Record<string,number>={};
  for(const p of rest){const k=(p.categories[0]?.category.fullSlug??"none").split("/").slice(0,2).join("/");top[k]=(top[k]||0)+1;}
  console.log(Object.entries(top).sort((a,b)=>b[1]-a[1]).slice(0,30));
  const fam=(c:string)=>c.match(/^[A-Z]+/)?.[0]??"num";
  const m:Record<string,number>={};
  for(const p of rest){const k=fam(p.code)+(p.description&&tl(p.description)>=350?"-ok":p.description&&tl(p.description)>0?"-short":"-none");m[k]=(m[k]||0)+1;}
  console.log(m);
  writeFileSync("ops/desc-work/cosmetics-audit.json",JSON.stringify(rest.map(p=>({code:p.code,name:p.name,brand:p.brand?.name,dlen:tl(p.description),imgs:p.images.length,sales:p.salesCount,stock:p.stock,own:p.ownStock,cats:p.categories.map(c=>c.category.fullSlug)}))));
}
main().finally(()=>prisma.$disconnect());
