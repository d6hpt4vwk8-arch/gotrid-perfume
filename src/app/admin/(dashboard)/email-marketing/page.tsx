import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { previewSecondOrderCandidates } from "@/lib/marketing/second-order-campaign";

const PREVIEW_TYPES = [
  { type: "order-confirmation", label: "Potvrzení objednávky" },
  { type: "abandoned-checkout", label: "Opuštěný košík" },
  { type: "second-order", label: "Sleva na druhou objednávku" },
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

export default async function EmailMarketingPage() {
  const [
    abandonedTotal,
    abandonedEmailed,
    abandonedRecovered,
    abandonedPending,
    abandonedFailedLogs,
    abandonedSkippedOutOfStock,
    recentAbandoned,
    secondOrderSentLogs,
    guestOrders,
    registeredOrders,
    confirmationFailures,
    upcomingSecondOrder,
  ] = await Promise.all([
    prisma.abandonedCheckout.count(),
    prisma.abandonedCheckout.count({ where: { emailSentAt: { not: null } } }),
    prisma.abandonedCheckout.count({ where: { recoveredAt: { not: null } } }),
    prisma.abandonedCheckout.count({ where: { emailSentAt: null, recoveredAt: null } }),
    prisma.adminActivityLog.count({ where: { action: "marketing.abandoned_checkout_email_failed" } }),
    prisma.adminActivityLog.count({
      where: { action: "marketing.abandoned_checkout_skipped_out_of_stock" },
    }),
    prisma.abandonedCheckout.findMany({ orderBy: { capturedAt: "desc" }, take: 50 }),
    prisma.adminActivityLog.findMany({
      where: { action: "marketing.second_order_email" },
      orderBy: { createdAt: "desc" },
    }),
    prisma.order.count({ where: { customerId: null, status: { notIn: ["NEW", "CANCELLED"] } } }),
    prisma.order.count({ where: { customerId: { not: null }, status: { notIn: ["NEW", "CANCELLED"] } } }),
    prisma.adminActivityLog.count({
      where: { action: { in: ["order.confirmation_email_failed", "order.owner_notification_email_failed"] } },
    }),
    previewSecondOrderCandidates(),
  ]);

  // Coupon code is embedded in the log detail string ("... s kódem XXXX ...")
  // rather than stored as its own column — parse it back out to show
  // redemption status per sent email.
  const codeByLogId = new Map<string, string>();
  for (const log of secondOrderSentLogs) {
    const match = log.detail?.match(/s kódem (\S+)/);
    if (match) codeByLogId.set(log.id, match[1]);
  }
  const codes = [...codeByLogId.values()];
  const coupons = codes.length
    ? await prisma.coupon.findMany({ where: { code: { in: codes } }, select: { code: true, usedCount: true } })
    : [];
  const usedCountByCode = new Map(coupons.map((c) => [c.code, c.usedCount]));

  const totalOrders = guestOrders + registeredOrders;

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-2xl font-bold text-ink">E-mail marketing</h1>
        <p className="text-sm text-accent-2">
          Přehled automatických e-mailů (opuštěný košík, druhá objednávka, potvrzení objednávky) — kolik se
          jich odeslalo, kolik selhalo a jak vypadají. Hromadné newslettery jsou v{" "}
          <Link href="/admin/newsletter" className="underline">
            samostatné sekci
          </Link>
          .
        </p>
      </div>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold text-ink">Náhled e-mailů</h2>
        <div className="flex flex-wrap gap-3">
          {PREVIEW_TYPES.map((p) => (
            <a
              key={p.type}
              href={`/api/admin/email-preview/${p.type}`}
              target="_blank"
              rel="noreferrer"
              className="rounded-sm border border-line bg-white px-4 py-2 text-sm font-medium hover:border-accent-2"
            >
              {p.label} →
            </a>
          ))}
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold text-ink">Opuštěné košíky</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-6">
          <StatCard label="Zachyceno celkem" value={abandonedTotal} />
          <StatCard label="Odesláno připomenutí" value={abandonedEmailed} />
          <StatCard label="Vráceno a objednáno" value={abandonedRecovered} />
          <StatCard label="Čeká na odeslání" value={abandonedPending} />
          <StatCard
            label="Přeskočeno (vyprodáno)"
            value={abandonedSkippedOutOfStock}
            hint="košík mezitím vyprodán, e-mail se neposlal"
          />
          <StatCard
            label="Selhalo odeslání"
            value={abandonedFailedLogs}
            hint={abandonedFailedLogs > 0 ? "viz Log činností" : undefined}
          />
        </div>

        <div className="overflow-x-auto rounded-sm border border-line bg-white">
          <table className="w-full min-w-[700px] text-sm">
            <thead className="border-b border-line bg-white text-left text-xs uppercase text-accent-2">
              <tr>
                <th className="px-3 py-2">Zachyceno</th>
                <th className="px-3 py-2">E-mail</th>
                <th className="px-3 py-2">Stav</th>
              </tr>
            </thead>
            <tbody>
              {recentAbandoned.map((row) => {
                const status = row.recoveredAt
                  ? "Objednal(a) sám/sama před odesláním"
                  : row.emailSentAt
                    ? "Připomenutí odesláno"
                    : "Čeká";
                return (
                  <tr key={row.id} className="border-b border-line last:border-0">
                    <td className="whitespace-nowrap px-3 py-2 text-accent-2">
                      {new Date(row.capturedAt).toLocaleString("cs-CZ")}
                    </td>
                    <td className="px-3 py-2">{row.email}</td>
                    <td className="px-3 py-2">{status}</td>
                  </tr>
                );
              })}
              {recentAbandoned.length === 0 && (
                <tr>
                  <td colSpan={3} className="px-3 py-4 text-center text-accent-2">
                    Zatím žádné záznamy.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold text-ink">Sleva na druhou objednávku</h2>
        <p className="text-xs text-accent-2">
          Od 2026-09-18 dostávají toto e-mail i hosté bez účtu (dřív jen registrovaní se zapnutým
          odběrem) — právní základ: §7 odst. 3 zákona č. 480/2004 Sb. (existující zákazník, podobné
          zboží), odhlášení respektováno přes NewsletterUnsubscribe.
        </p>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatCard label="Odesláno celkem" value={secondOrderSentLogs.length} />
          <StatCard label="Kódy uplatněny" value={coupons.filter((c) => c.usedCount > 0).length} />
          <StatCard label="Čeká na příští běh" value={upcomingSecondOrder.length} />
          <StatCard
            label="Objednávky host / účet"
            value={`${guestOrders} / ${registeredOrders}`}
            hint={`z ${totalOrders} objednávek celkem`}
          />
        </div>

        <div className="overflow-x-auto rounded-sm border border-line bg-white">
          <table className="w-full min-w-[700px] text-sm">
            <thead className="border-b border-line bg-white text-left text-xs uppercase text-accent-2">
              <tr>
                <th className="px-3 py-2">Odesláno</th>
                <th className="px-3 py-2">Detail</th>
                <th className="px-3 py-2">Kód uplatněn?</th>
              </tr>
            </thead>
            <tbody>
              {secondOrderSentLogs.map((log) => {
                const code = codeByLogId.get(log.id);
                const used = code ? (usedCountByCode.get(code) ?? 0) > 0 : null;
                return (
                  <tr key={log.id} className="border-b border-line last:border-0">
                    <td className="whitespace-nowrap px-3 py-2 text-accent-2">
                      {new Date(log.createdAt).toLocaleString("cs-CZ")}
                    </td>
                    <td className="px-3 py-2">{log.detail}</td>
                    <td className="px-3 py-2">{used === null ? "—" : used ? "Ano" : "Ne"}</td>
                  </tr>
                );
              })}
              {secondOrderSentLogs.length === 0 && (
                <tr>
                  <td colSpan={3} className="px-3 py-4 text-center text-accent-2">
                    Zatím žádný odeslaný e-mail.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold text-ink">Potvrzení objednávky / oznámení majiteli</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <StatCard label="Reálné objednávky celkem" value={totalOrders} hint="≈ počet odeslaných potvrzení" />
          <StatCard
            label="Selhalo odeslání"
            value={confirmationFailures}
            hint={confirmationFailures > 0 ? "viz Log činností" : "žádná známá chyba"}
          />
        </div>
      </section>
    </div>
  );
}
