// Weekly personalised e-mail to past buyers. DRY RUN by default (counts only, nothing mailed or logged);
// add --apply to really send. Must run with the production site URL so links and images point at the live shop:
//
//   NEXT_PUBLIC_SITE_URL=https://gotridperfume.cz npx tsx --env-file=.env scripts/weekly-newsletter-send.ts [--apply] [--limit 30]
import { prisma } from "../src/lib/prisma";
import { SITE_URL } from "../src/lib/site";
import { runWeeklyNewsletter } from "../src/lib/marketing/weekly-newsletter-campaign";

async function main() {
  const apply = process.argv.includes("--apply");
  const i = process.argv.indexOf("--limit");
  const limit = i >= 0 ? Number(process.argv[i + 1]) : undefined;
  if (apply && /localhost|127\.0\.0\.1/.test(SITE_URL)) {
    throw new Error(`Refusing to send with SITE_URL=${SITE_URL}; set NEXT_PUBLIC_SITE_URL=https://gotridperfume.cz`);
  }
  const row = await prisma.settings.upsert({ where: { id: "singleton" }, update: {}, create: { id: "singleton" } });
  const result = await runWeeklyNewsletter({
    apply,
    limit,
    settings: { freeShippingThreshold: Number(row.freeShippingThreshold), czkToEurRate: Number(row.czkToEurRate) },
  });
  console.log(apply ? "SENT" : "DRY RUN (nothing sent)", JSON.stringify(result, null, 1));
}

main().finally(() => prisma.$disconnect());
