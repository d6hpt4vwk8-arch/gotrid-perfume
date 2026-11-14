import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getNewsletterRecipientCount, sendNewsletterCampaign } from "@/lib/admin/actions/newsletter";
import { selectWeeklyRecipients, WEEKLY_NEWSLETTER_ACTION } from "@/lib/marketing/weekly-newsletter-campaign";
import { DELAY_NOTICE_ACTION } from "@/lib/marketing/delayed-orders-notice";
import { WISHLIST_EMAIL_ACTION } from "@/lib/marketing/wishlist-campaign";
import { NEW_ARRIVALS_ACTION } from "@/lib/marketing/new-arrivals";

const DAY_MS = 86_400_000;
const dateFmt = new Intl.DateTimeFormat("cs-CZ", { day: "numeric", month: "numeric", year: "numeric", timeZone: "Europe/Prague" });

interface AutoMail {
  action: string;
  name: string;
  when: string;
  status: "on" | "off" | "manual";
  note?: string;
}

// What the shop sends, in plain words. "on" = runs by itself from the daily cron; "off" = switched off;
// "manual" = only goes out when somebody starts it (script / form below).
const AUTO_MAILS: AutoMail[] = [
  { action: "marketing.review_request_email", name: "Žádost o recenzi", when: "po doručení objednávky", status: "on" },
  { action: "marketing.abandoned_checkout_email", name: "Opuštěný košík", when: "několik hodin po opuštění košíku", status: "on" },
  { action: WISHLIST_EMAIL_ACTION, name: "Oblíbené: změna ceny / skladu", when: "při změně ceny nebo skladu oblíbeného zboží", status: "on" },
  { action: DELAY_NOTICE_ACTION, name: "Omluva za zpoždění objednávky", when: "po uplynutí slíbeného termínu", status: process.env.DELAY_NOTICE_ENABLED === "true" ? "on" : "off", note: process.env.DELAY_NOTICE_ENABLED === "true" ? undefined : "vypnuto — chybí DELAY_NOTICE_ENABLED=true" },
  {
    action: NEW_ARRIVALS_ACTION,
    name: "Novinky pro odběratele",
    when: "1× týdně, jen nové zboží v kategoriích, které kupovali, nikdy dvakrát to samé",
    status: process.env.NEWSLETTER_AUTO_ENABLED === "true" ? "on" : "off",
    note: process.env.NEWSLETTER_AUTO_ENABLED === "true" ? undefined : "vypnuto — chybí NEWSLETTER_AUTO_ENABLED=true",
  },
  {
    action: WEEKLY_NEWSLETTER_ACTION,
    name: "Jednorázový výběr pro dřívější zákazníky",
    when: "jednou na člověka, ne odběratelé; po částech za den",
    status: process.env.NEWSLETTER_AUTO_ENABLED === "true" ? "on" : "off",
    note: process.env.NEWSLETTER_AUTO_ENABLED === "true" ? undefined : "vypnuto — chybí NEWSLETTER_AUTO_ENABLED=true",
  },
  { action: "marketing.second_order_email", name: "Sleva na druhou objednávku", when: "—", status: "off", note: "vypnuto od 18. 10. 2026" },
];

function StatCard({ label, value, hint }: { label: string; value: string | number; hint?: string }) {
  return (
    <div className="rounded-sm border border-line bg-white p-4">
      <span className="block text-xs uppercase text-accent-2">{label}</span>
      <span className="block text-2xl font-bold text-ink">{value}</span>
      {hint && <span className="mt-1 block text-xs text-accent-2">{hint}</span>}
    </div>
  );
}

function StatusBadge({ status }: { status: AutoMail["status"] }) {
  const cls =
    status === "on"
      ? "bg-green-50 text-green-700"
      : status === "manual"
        ? "bg-amber-50 text-amber-700"
        : "bg-gray-100 text-accent-2";
  const text = status === "on" ? "Zapnuto" : status === "manual" ? "Ručně" : "Vypnuto";
  return <span className={`inline-block rounded-sm px-2 py-0.5 text-xs font-medium ${cls}`}>{text}</span>;
}

export default async function AdminNewsletterPage() {
  const since30 = new Date(Date.now() - 30 * DAY_MS);
  const actions = AUTO_MAILS.map((m) => m.action);

  const [optInCount, unsubscribed, weekly, totals, last30, campaigns, weeklyLogs, abandoned, abandonedFailed, abandonedSkipped, couponUses, reviewsPublished] = await Promise.all([
    getNewsletterRecipientCount(),
    prisma.newsletterUnsubscribe.count(),
    selectWeeklyRecipients(),
    prisma.adminActivityLog.groupBy({ by: ["action"], where: { action: { in: actions } }, _count: true, _max: { createdAt: true } }),
    prisma.adminActivityLog.groupBy({ by: ["action"], where: { action: { in: actions }, createdAt: { gte: since30 } }, _count: true }),
    prisma.newsletterCampaign.findMany({ orderBy: { sentAt: "desc" }, take: 20 }),
    prisma.adminActivityLog.findMany({ where: { action: WEEKLY_NEWSLETTER_ACTION }, select: { createdAt: true } }),
    prisma.abandonedCheckout.findMany({ select: { emailSentAt: true, recoveredAt: true } }),
    prisma.adminActivityLog.count({ where: { action: "marketing.abandoned_checkout_email_failed" } }),
    prisma.adminActivityLog.count({ where: { action: "marketing.abandoned_checkout_skipped_out_of_stock" } }),
    prisma.coupon.aggregate({ where: { secondOrderOnly: true }, _sum: { usedCount: true } }),
    prisma.review.count({ where: { published: true } }),
  ]);

  // "Recovered" in the abandoned-cart table also covers people who finished the order on their own; the honest result of
  // the reminder is: ordered AFTER the reminder was sent.
  const abandonedEmailed = abandoned.filter((a) => a.emailSentAt);
  const orderedAfterReminder = abandonedEmailed.filter((a) => a.recoveredAt && a.emailSentAt && a.recoveredAt >= a.emailSentAt).length;
  const reminderRate = abandonedEmailed.length ? Math.round((orderedAfterReminder / abandonedEmailed.length) * 100) : 0;

  const totalBy = new Map(totals.map((t) => [t.action, t]));
  const last30By = new Map(last30.map((t) => [t.action, t._count]));
  const sent30 = last30.reduce((s, t) => s + t._count, 0);

  // Weekly picks are logged one row per recipient — fold them into "one send per day" for the history.
  const weeklyByDay = new Map<string, { at: Date; count: number }>();
  for (const l of weeklyLogs) {
    const key = dateFmt.format(l.createdAt);
    const cur = weeklyByDay.get(key);
    if (cur) cur.count++;
    else weeklyByDay.set(key, { at: l.createdAt, count: 1 });
  }
  const history = [
    ...campaigns.map((c) => ({ at: c.sentAt, subject: c.subject, kind: "Ruční newsletter", count: c.recipientCount })),
    ...[...weeklyByDay.values()].map((w) => ({ at: w.at, subject: "Týdenní výběr produktů", kind: "Týdenní výběr", count: w.count })),
  ].sort((a, b) => b.at.getTime() - a.at.getTime());

  return (
    <div className="flex max-w-5xl flex-col gap-6">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h1 className="text-2xl font-bold text-ink">Newsletter</h1>
        <Link href="/admin/email-marketing" className="text-sm text-accent-2 underline">
          Opuštěné košíky a náhledy e-mailů
        </Link>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="Odběratelé newsletteru" value={optInCount} hint="přihlášení k newsletteru — dostávají týdenní Novinky a ruční newslettery" />
        <StatCard label="Jednorázový výběr: zbývá" value={weekly.recipients.length} hint="dřívější zákazníci, kteří ještě nic nedostali (odběratelé a odhlášení se nepočítají)" />
        <StatCard label="Odhlášeno" value={unsubscribed} hint="těmto adresám se marketing neposílá" />
        <StatCard label="Odesláno za 30 dní" value={sent30} hint="automatické a týdenní e-maily dohromady" />
      </div>

      <div className="rounded-sm border border-line bg-white">
        <div className="border-b border-line p-4">
          <span className="text-xs font-semibold uppercase text-accent-2">Jaké e-maily se posílají</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-xs uppercase text-accent-2">
              <tr>
                <th className="px-4 py-2 font-medium">E-mail</th>
                <th className="px-4 py-2 font-medium">Stav</th>
                <th className="px-4 py-2 font-medium">Posledně</th>
                <th className="px-4 py-2 text-right font-medium">30 dní</th>
                <th className="px-4 py-2 text-right font-medium">Celkem</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {AUTO_MAILS.map((m) => {
                const t = totalBy.get(m.action);
                return (
                  <tr key={m.action}>
                    <td className="px-4 py-2.5">
                      <span className="block font-medium text-ink">{m.name}</span>
                      <span className="block text-xs text-accent-2">
                        {m.when}
                        {m.note ? ` · ${m.note}` : ""}
                      </span>
                    </td>
                    <td className="px-4 py-2.5">
                      <StatusBadge status={m.status} />
                    </td>
                    <td className="whitespace-nowrap px-4 py-2.5 text-accent-2">{t?._max.createdAt ? dateFmt.format(t._max.createdAt) : "—"}</td>
                    <td className="px-4 py-2.5 text-right">{last30By.get(m.action) ?? 0}</td>
                    <td className="px-4 py-2.5 text-right">{t?._count ?? 0}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="border-t border-line p-4 text-xs text-accent-2">
          Odeslané e-maily s jednotlivými adresami najdete v{" "}
          <Link href="/admin/log" className="underline">
            Logu činností
          </Link>
          .
        </p>
      </div>

      <div className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold text-ink">Výsledky automatických e-mailů</h2>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <StatCard label="Opuštěné košíky" value={abandoned.length} hint="zachyceno celkem (e-mail zadán, objednávka nedokončena)" />
          <StatCard label="Připomenutí odesláno" value={abandonedEmailed.length} hint={`selhalo ${abandonedFailed}, přeskočeno kvůli skladu ${abandonedSkipped}`} />
          <StatCard label="Objednali po připomenutí" value={orderedAfterReminder} hint={`${reminderRate} % z odeslaných`} />
          <StatCard label="Sleva na 2. objednávku" value={`${couponUses._sum.usedCount ?? 0} užití`} hint={`e-mail vypnutý od 18. 10., rozesláno ${totalBy.get("marketing.second_order_email")?._count ?? 0}`} />
          <StatCard label="Žádost o recenzi" value={totalBy.get("marketing.review_request_email")?._count ?? 0} hint={`publikovaných recenzí celkem: ${reviewsPublished}`} />
          <StatCard label="Oblíbené (cena/sklad)" value={totalBy.get(WISHLIST_EMAIL_ACTION)?._count ?? 0} hint="odesláno celkem" />
        </div>
        <p className="text-xs text-accent-2">
          Podrobnosti, seznam košíků a náhledy e-mailů:{" "}
          <Link href="/admin/email-marketing" className="underline">
            E-mail marketing
          </Link>
          .
        </p>
      </div>

      <details className="rounded-sm border border-line bg-white">
        <summary className="cursor-pointer p-4 text-sm font-semibold text-ink">Napsat ruční newsletter ({optInCount} příjemců)</summary>
        <form action={sendNewsletterCampaign} className="flex flex-col gap-4 border-t border-line p-4">
          <p className="text-sm text-accent-2">
            Odešle se <strong>{optInCount}</strong> příjemcům (zaregistrovaní zákazníci s aktivním odběrem novinek).
          </p>
          <label className="flex flex-col gap-1 text-sm">
            Předmět
            <input name="subject" required placeholder="Např. Nová kolekce parfémů je tu" className="rounded-sm border border-line px-3 py-2" />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            Text e-mailu (HTML)
            <textarea name="body" required rows={10} placeholder="<h1>Ahoj!</h1><p>...</p>" className="rounded-sm border border-line px-3 py-2 font-mono text-xs" />
            <span className="text-xs text-accent-2">Odkaz pro odhlášení se do e-mailu přidá automaticky.</span>
          </label>
          <button type="submit" className="w-fit rounded-sm bg-ink px-5 py-2.5 text-sm font-medium text-white hover:bg-accent">
            Odeslat newsletter
          </button>
        </form>
      </details>

      <div className="rounded-sm border border-line bg-white">
        <div className="border-b border-line p-4">
          <span className="text-xs font-semibold uppercase text-accent-2">Historie newsletterů</span>
        </div>
        {history.length === 0 ? (
          <p className="p-4 text-sm text-accent-2">Zatím nic nebylo odesláno.</p>
        ) : (
          <ul className="divide-y divide-line text-sm">
            {history.map((h, i) => (
              <li key={i} className="flex flex-wrap items-baseline justify-between gap-2 px-4 py-2.5">
                <span>
                  <span className="font-medium text-ink">{h.subject}</span>
                  <span className="ml-2 text-xs text-accent-2">{h.kind}</span>
                </span>
                <span className="text-accent-2">
                  {dateFmt.format(h.at)} · {h.count} příjemců
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
