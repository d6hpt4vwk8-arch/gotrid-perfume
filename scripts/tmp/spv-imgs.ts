import { prisma } from "../../src/lib/prisma";
import sharp from "sharp";
import { readFile } from "node:fs/promises";
async function main(){
  const ps=await prisma.product.findMany({where:{code:{in:["SPV-0247763","SPV-0247766","SPV-0247761","SPV-0243469","SPV-0247760","SPV-0247765","SPV-0247764","SPV-0247767"]}},select:{code:true,name:true,images:{select:{url:true},orderBy:{sortOrder:"asc"}}, description:true}});
  for(const p of ps){ const dims=[]; for(const i of p.images){ try{ const m=await sharp(await readFile("public"+i.url)).metadata(); dims.push(m.width+"x"+m.height);}catch(e){dims.push(i.url.startsWith("http")?"remote":"missing");} } console.log(p.code,p.name.slice(0,45),dims.join(" ")); }
  console.log((await prisma.product.findUnique({where:{code:"SPV-0247764"},select:{description:true}}))!.description);
}
main().finally(()=>prisma.$disconnect());
