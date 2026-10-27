import { prisma } from "../../src/lib/prisma";
async function main(){ for (const c of ["SPV-0247765","GVS-255385","GVS-3012017"]) { const p=await prisma.product.findUnique({where:{code:c},select:{slug:true}}); console.log(c,p?.slug); } }
main().finally(()=>prisma.$disconnect());
