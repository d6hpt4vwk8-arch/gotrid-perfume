// Dry run of the Nama Fiji follow-up: who would get the 10 % code now, plus a rendered sample. Sends/creates nothing.
//   NEXT_PUBLIC_SITE_URL=https://gotridperfume.cz npx tsx --env-file=.env scripts/nama-followup-preview.ts
import { mkdir, writeFile } from "node:fs/promises";
import { prisma } from "../src/lib/prisma";
import { getNamaFollowupCandidates } from "../src/lib/marketing/nama-followup";
import { renderNamaFollowupHtml } from "../src/lib/email/send-nama-followup-email";

async function main() {
  const c = await getNamaFollowupCandidates();
  console.log(`Would get the Nama Fiji code now: ${c.length}`);
  c.forEach((x) => console.log("  " + x.email.replace(/(.).*@/, "$1***@"), x.country));
  const row = await prisma.settings.upsert({ where: { id: "singleton" }, update: {}, create: { id: "singleton" } });
  const html = await renderNamaFollowupHtml({
    settings: { freeShippingThreshold: Number(row.freeShippingThreshold), czkToEurRate: Number(row.czkToEurRate) },
    email: "preview@example.com",
    firstName: "Jana",
    locale: "cs",
    code: "NAMA-ABC234",
    percent: 10,
    expiresAt: new Date(Date.now() + 14 * 86400000),
    unsubscribeUrl: "https://gotridperfume.cz/odhlasit",
  });
  await mkdir("ops/newsletter-preview", { recursive: true });
  await writeFile("ops/newsletter-preview/nama-followup.html", html);
  console.log("Preview: ops/newsletter-preview/nama-followup.html");
}
main().finally(() => prisma.$disconnect());
