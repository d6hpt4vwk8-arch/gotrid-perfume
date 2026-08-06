// Seeds the SkinType/Concern taxonomies for the Kosmetika filter facets.
// Unlike scentFamily there's no honest way to auto-tag these from existing
// product text, so this only creates the tag vocabulary — tagging individual
// products happens manually in the admin product editor.
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const SKIN_TYPES = [
  { slug: "sucha", name: "Suchá pleť" },
  { slug: "mastna", name: "Mastná pleť" },
  { slug: "smisena", name: "Smíšená pleť" },
  { slug: "citliva", name: "Citlivá pleť" },
  { slug: "normalni", name: "Normální pleť" },
];

const CONCERNS = [
  { slug: "hydratace", name: "Hydratace" },
  { slug: "akne", name: "Akné a nečistoty" },
  { slug: "vrasky-starnuti", name: "Vrásky a stárnutí pleti" },
  { slug: "pigmentace", name: "Pigmentace a tmavé skvrny" },
  { slug: "zarudnuti-citlivost", name: "Zarudnutí a podráždění" },
  { slug: "rozjasneni", name: "Rozjasnění pleti" },
  { slug: "cisteni-detox", name: "Hloubkové čištění" },
];

async function main() {
  for (const s of SKIN_TYPES) {
    await prisma.skinType.upsert({ where: { slug: s.slug }, update: { name: s.name }, create: s });
  }
  for (const c of CONCERNS) {
    await prisma.concern.upsert({ where: { slug: c.slug }, update: { name: c.name }, create: c });
  }
  console.log(`Seeded ${SKIN_TYPES.length} skin types and ${CONCERNS.length} concerns.`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
