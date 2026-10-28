// Dry run of the weekly personalised e-mail: sizes the segments, builds one sample e-mail per segment and
// writes them to ops/newsletter-preview/*.html (+ index.html). SENDS NOTHING. Samples use the real buyer's
// order history for picks but a dummy address in the unsubscribe link and no e-mail address in the file.
//
//   npx tsx --env-file=.env scripts/weekly-newsletter-preview.ts
import { mkdir, writeFile } from "node:fs/promises";
import { prisma } from "../src/lib/prisma";
import { planWeeklyNewsletter } from "../src/lib/marketing/weekly-newsletter";
import { renderWeeklyNewsletterHtml } from "../src/lib/email/weekly-newsletter-email";

const COUNTABLE = ["NEW", "PAID", "PROCESSING", "SHIPPED", "DELIVERED"] as const;
const PERFUME_ROOTS = ["Parfémy", "Niche"];
const HOME_ROOTS = ["Aroma Difuzéry", "Vonné svíčky", "Vůně do auta"];
const MIN_DAYS_SINCE_ORDER = 14;
const OUT = "ops/newsletter-preview";

function segmentOf(rootName: string): string {
  if (PERFUME_ROOTS.includes(rootName)) return "Parfémy";
  if (HOME_ROOTS.includes(rootName)) return "Vůně do domova a auta";
  return rootName;
}

const slug = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

async function main() {
  const categories = await prisma.category.findMany({ select: { id: true, name: true, parentId: true } });
  const byId = new Map(categories.map((c) => [c.id, c]));
  const rootName = (id: string): string | null => {
    let cur = byId.get(id);
    while (cur?.parentId) cur = byId.get(cur.parentId);
    return cur?.name ?? null;
  };

  const orders = await prisma.order.findMany({
    where: { status: { in: [...COUNTABLE] } },
    select: {
      email: true,
      firstName: true,
      createdAt: true,
      items: { where: { isGift: false }, select: { qty: true, product: { select: { categories: { select: { categoryId: true } } } } } },
    },
    orderBy: { createdAt: "asc" },
  });
  const unsubscribed = new Set((await prisma.newsletterUnsubscribe.findMany({ select: { email: true } })).map((u) => u.email.toLowerCase()));

  type Buyer = { email: string; firstName: string; orders: number; last: Date; weight: Map<string, number> };
  const buyers = new Map<string, Buyer>();
  for (const o of orders) {
    const key = o.email.trim().toLowerCase();
    const b = buyers.get(key) ?? { email: o.email, firstName: o.firstName ?? "", orders: 0, last: o.createdAt, weight: new Map() };
    b.orders++;
    b.last = o.createdAt;
    b.firstName = o.firstName || b.firstName;
    for (const it of o.items) {
      const roots = new Set((it.product?.categories ?? []).map((c) => rootName(c.categoryId)).filter((r): r is string => !!r && r !== "Výprodej"));
      for (const r of roots) b.weight.set(segmentOf(r), (b.weight.get(segmentOf(r)) ?? 0) + it.qty);
    }
    buyers.set(key, b);
  }

  const now = Date.now();
  let unsub = 0;
  let tooRecent = 0;
  let noHistory = 0;
  const segments = new Map<string, Buyer[]>();
  for (const [key, b] of buyers) {
    if (unsubscribed.has(key)) { unsub++; continue; }
    if (now - b.last.getTime() < MIN_DAYS_SINCE_ORDER * 86400000) { tooRecent++; continue; }
    const top = [...b.weight.entries()].sort((a, c) => c[1] - a[1])[0];
    if (!top) { noHistory++; continue; }
    segments.set(top[0], [...(segments.get(top[0]) ?? []), b]);
  }

  const row = await prisma.settings.upsert({ where: { id: "singleton" }, update: {}, create: { id: "singleton" } });
  const settings = { freeShippingThreshold: Number(row.freeShippingThreshold), czkToEurRate: Number(row.czkToEurRate) };

  await mkdir(OUT, { recursive: true });
  const rows: string[] = [];
  const sorted = [...segments.entries()].sort((a, c) => c[1].length - a[1].length);
  for (const [name, list] of sorted) {
    const sample = [...list].sort((a, c) => c.orders - a.orders || c.last.getTime() - a.last.getTime())[0];
    const plan = await planWeeklyNewsletter(sample.email, sample.firstName);
    const html = await renderWeeklyNewsletterHtml(plan, { unsubscribeEmail: "ukazka@example.com", settings });
    const file = `${slug(name)}.html`;
    await writeFile(`${OUT}/${file}`, html);
    const list3 = (xs: { name: string }[]) => xs.map((p) => p.name).join("<br>") || "—";
    rows.push(
      `<tr><td><a href="${file}">${name}</a></td><td>${list.length}</td><td>${plan.subject}</td><td>${list3(plan.picks)}</td><td>${list3(plan.complements)}</td><td>${list3(plan.deals)}</td></tr>`,
    );
    console.log(`${name.padEnd(28)} ${String(list.length).padStart(4)} příjemců | picks ${plan.picks.length}, complements ${plan.complements.length}, deals ${plan.deals.length}`);
  }
  const total = sorted.reduce((n, [, l]) => n + l.length, 0);
  await writeFile(
    `${OUT}/index.html`,
    `<!doctype html><meta charset="utf-8"><title>Týdenní e-mail — náhled</title><body style="font-family:sans-serif;max-width:1100px;margin:2rem auto"><h1>Týdenní e-mail — náhled (nic se neodesílá)</h1>` +
      `<p>Příjemci dnes: <b>${total}</b> · vyřazeno: odhlášení ${unsub}, objednali před méně než ${MIN_DAYS_SINCE_ORDER} dny ${tooRecent}, bez historie ${noHistory}.</p>` +
      `<table border="1" cellpadding="6" style="border-collapse:collapse;font-size:13px"><tr><th>Segment</th><th>Příjemců</th><th>Předmět</th><th>Pro vás</th><th>K tomu se hodí</th><th>Zlevněno</th></tr>${rows.join("")}</table></body>`,
  );
  console.log(`\nRecipients today: ${total} (unsubscribed ${unsub}, ordered <${MIN_DAYS_SINCE_ORDER}d ago ${tooRecent}, no history ${noHistory}). Open ${OUT}/index.html`);
}

main().finally(() => prisma.$disconnect());
