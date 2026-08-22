import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getNewsletterRecipientCount, sendNewsletterCampaign } from "@/lib/admin/actions/newsletter";
import { previewSecondOrderCandidates } from "@/lib/marketing/second-order-campaign";

export default async function AdminNewsletterPage() {
  const [recipientCount, campaigns, upcomingSecondOrder] = await Promise.all([
    getNewsletterRecipientCount(),
    prisma.newsletterCampaign.findMany({ orderBy: { sentAt: "desc" }, take: 20 }),
    previewSecondOrderCandidates(),
  ]);

  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <h1 className="text-2xl font-bold text-ink">Newsletter</h1>

      <div className="rounded-sm border border-line bg-white p-4">
        <span className="mb-2 block text-xs font-semibold uppercase text-accent-2">
          E-mail „druhá objednávka“ — komu se pošle v příštím běhu ({upcomingSecondOrder.length})
        </span>
        {upcomingSecondOrder.length === 0 ? (
          <p className="text-sm text-accent-2">Momentálně nikdo nesplňuje podmínky.</p>
        ) : (
          <ul className="flex flex-col divide-y divide-line text-sm">
            {upcomingSecondOrder.map((c) => (
              <li key={c.orderId} className="flex justify-between py-1.5">
                <span>{c.firstName}</span>
                <span className="text-accent-2">{c.email}</span>
              </li>
            ))}
          </ul>
        )}
        <p className="mt-2 text-xs text-accent-2">
          Reálně odeslané e-maily (s vygenerovaným kódem) najdete v{" "}
          <Link href="/admin/log" className="underline">
            Logu činností
          </Link>
          .
        </p>
      </div>

      <div className="rounded-sm border border-line bg-white p-4">
        <form action={sendNewsletterCampaign} className="flex flex-col gap-4">
          <p className="text-sm text-accent-2">
            Odešle se <strong>{recipientCount}</strong> příjemcům (zaregistrovaní zákazníci
            s aktivním odběrem novinek).
          </p>
          <label className="flex flex-col gap-1 text-sm">
            Předmět
            <input
              name="subject"
              required
              placeholder="Např. Nová kolekce parfémů je tu"
              className="rounded-sm border border-line px-3 py-2"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            Text e-mailu (HTML)
            <textarea
              name="body"
              required
              rows={10}
              placeholder="<h1>Ahoj!</h1><p>...</p>"
              className="rounded-sm border border-line px-3 py-2 font-mono text-xs"
            />
            <span className="text-xs text-accent-2">
              Odkaz pro odhlášení se do e-mailu přidá automaticky.
            </span>
          </label>
          <button
            type="submit"
            className="w-fit rounded-sm bg-ink px-5 py-2.5 text-sm font-medium text-white hover:bg-accent"
          >
            Odeslat newsletter
          </button>
        </form>
      </div>

      <div className="rounded-sm border border-line bg-white p-4">
        <span className="mb-2 block text-xs font-semibold uppercase text-accent-2">
          Historie odeslaných
        </span>
        <ul className="flex flex-col divide-y divide-line text-sm">
          {campaigns.map((c) => (
            <li key={c.id} className="flex justify-between py-2">
              <span>{c.subject}</span>
              <span className="text-accent-2">
                {new Date(c.sentAt).toLocaleString("cs-CZ")} · {c.recipientCount} příjemců
              </span>
            </li>
          ))}
          {campaigns.length === 0 && (
            <li className="py-2 text-accent-2">Zatím nic nebylo odesláno.</li>
          )}
        </ul>
      </div>
    </div>
  );
}
