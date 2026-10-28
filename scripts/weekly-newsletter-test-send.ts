// Sends ONE test copy of the weekly e-mail to a single address (the owner's), built from a real buyer's order
// history of the chosen segment. Never mails the buyer himself. The greeting uses --name.
//
//   npx tsx --env-file=.env scripts/weekly-newsletter-test-send.ts --to you@example.com --name Pavlo [--segment Kosmetika]
import { prisma } from "../src/lib/prisma";
import { planWeeklyNewsletter } from "../src/lib/marketing/weekly-newsletter";
import { renderWeeklyNewsletterHtml } from "../src/lib/email/weekly-newsletter-email";
import { EMAIL_FROM, getResendClient, isEmailConfigured } from "../src/lib/email/resend";

const arg = (name: string) => {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
};
const PERFUME_ROOTS = ["Parfémy", "Niche"];
const HOME_ROOTS = ["Aroma Difuzéry", "Vonné svíčky", "Vůně do auta"];
const segmentOf = (root: string) => (PERFUME_ROOTS.includes(root) ? "Parfémy" : HOME_ROOTS.includes(root) ? "Vůně do domova a auta" : root);

async function main() {
  const to = arg("to");
  const name = arg("name") ?? "";
  const segment = arg("segment") ?? "Kosmetika";
  if (!to) throw new Error("--to is required");
  if (!isEmailConfigured()) throw new Error("RESEND_API_KEY is not set");

  const categories = await prisma.category.findMany({ select: { id: true, name: true, parentId: true } });
  const byId = new Map(categories.map((c) => [c.id, c]));
  const rootName = (id: string) => {
    let cur = byId.get(id);
    while (cur?.parentId) cur = byId.get(cur.parentId);
    return cur?.name ?? null;
  };
  const orders = await prisma.order.findMany({
    where: { status: { in: ["NEW", "PAID", "PROCESSING", "SHIPPED", "DELIVERED"] } },
    select: { email: true, items: { where: { isGift: false }, select: { qty: true, product: { select: { categories: { select: { categoryId: true } } } } } } },
  });
  const buyers = new Map<string, { email: string; orders: number; weight: Map<string, number> }>();
  for (const o of orders) {
    const key = o.email.trim().toLowerCase();
    const b = buyers.get(key) ?? { email: o.email, orders: 0, weight: new Map() };
    b.orders++;
    for (const it of o.items) {
      const roots = new Set((it.product?.categories ?? []).map((c) => rootName(c.categoryId)).filter((r): r is string => !!r && r !== "Výprodej"));
      for (const r of roots) b.weight.set(segmentOf(r), (b.weight.get(segmentOf(r)) ?? 0) + it.qty);
    }
    buyers.set(key, b);
  }
  const sample = [...buyers.values()]
    .filter((b) => [...b.weight.entries()].sort((a, c) => c[1] - a[1])[0]?.[0] === segment)
    .sort((a, c) => c.orders - a.orders)[0];
  if (!sample) throw new Error(`No buyer found for segment ${segment}`);

  const plan = { ...(await planWeeklyNewsletter(sample.email, name)), email: to, firstName: name };
  const row = await prisma.settings.upsert({ where: { id: "singleton" }, update: {}, create: { id: "singleton" } });
  const html = await renderWeeklyNewsletterHtml(plan, { unsubscribeEmail: to, settings: { freeShippingThreshold: Number(row.freeShippingThreshold), czkToEurRate: Number(row.czkToEurRate) } });

  const { data, error } = await getResendClient().emails.send({ from: EMAIL_FROM, to, subject: `[TEST] ${plan.subject}`, html });
  if (error) throw new Error(`Resend error: ${error.message}`);
  console.log(`Sent test "${plan.subject}" (segment ${segment}) to ${to}; resend id ${data?.id}`);
}

main().finally(() => prisma.$disconnect());
