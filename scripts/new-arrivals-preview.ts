// Dry run of the subscriber "Novinky" mail: who would get one today and with which products. Sends and logs nothing.
//   NEXT_PUBLIC_SITE_URL=https://gotridperfume.cz npx tsx --env-file=.env scripts/new-arrivals-preview.ts
import { mkdir, writeFile } from "node:fs/promises";
import { prisma } from "../src/lib/prisma";
import { planNewArrivals, selectNewArrivalsRecipients } from "../src/lib/marketing/new-arrivals";
import { selectWeeklyRecipients } from "../src/lib/marketing/weekly-newsletter-campaign";
import { renderNewArrivalsHtml } from "../src/lib/email/new-arrivals-email";

async function main() {
  const subs = await selectNewArrivalsRecipients();
  let due = 0;
  let first: Awaited<ReturnType<typeof planNewArrivals>> = null;
  const lines: string[] = [];
  for (const s of subs) {
    const plan = await planNewArrivals(s.email, s.firstName).catch(() => null);
    if (!plan) continue;
    due++;
    first ??= plan;
    lines.push(`${s.email.replace(/(.).*@/, "$1***@")} | ${plan.subject} | ${plan.products.map((p) => p.name.slice(0, 32)).join(" / ")}`);
  }
  console.log(`Subscribers ${subs.length}, would get a Novinky mail now: ${due}`);
  lines.slice(0, 12).forEach((l) => console.log("  " + l));
  const oneOff = await selectWeeklyRecipients();
  console.log(`One-off pick still to send: ${oneOff.recipients.length}`, JSON.stringify(oneOff.skipped));
  if (first) {
    const row = await prisma.settings.upsert({ where: { id: "singleton" }, update: {}, create: { id: "singleton" } });
    const html = await renderNewArrivalsHtml(first, {
      unsubscribeEmail: "preview@example.com",
      settings: { freeShippingThreshold: Number(row.freeShippingThreshold), czkToEurRate: Number(row.czkToEurRate) },
    });
    await mkdir("ops/newsletter-preview", { recursive: true });
    await writeFile("ops/newsletter-preview/new-arrivals.html", html);
    console.log("Preview: ops/newsletter-preview/new-arrivals.html");
  }
}
main().finally(() => prisma.$disconnect());
