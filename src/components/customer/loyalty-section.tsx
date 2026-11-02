import Image from "next/image";
import type { Coupon, LoyaltyReward } from "@prisma/client";
import { getCurrentLocale, getTr } from "@/i18n/tr.server";
import { prisma } from "@/lib/prisma";
import { getSettings } from "@/lib/settings.server";
import { currencyForLocale } from "@/lib/currency";
import { formatPriceIn } from "@/lib/format";
import { getLoyaltySummary, listActiveRewards, listPersonalCoupons } from "@/lib/loyalty-rewards";
import { redeemLoyaltyReward } from "@/lib/customer/loyalty-actions";
import { CopyCoupon } from "@/components/customer/copy-coupon";

type Price = (czk: number) => string;
type Tr = Awaited<ReturnType<typeof getTr>>;

/** One-line description of what a reward / personal coupon gives, e.g. "Sleva 100 Kč při nákupu od 600 Kč". */
function describe(
  tr: Tr,
  price: Price,
  item: { type: string; value: unknown; minOrderValue: unknown },
  giftName: string | null,
): string {
  const min = item.minOrderValue ? Number(item.minOrderValue) : 0;
  if (item.type === "FREE_SHIPPING") return tr("Doprava zdarma k vaší další objednávce");
  if (item.type === "GIFT") return giftName ? tr("Dárek zdarma k další objednávce: {name}", { name: giftName }) : tr("Dárek zdarma k další objednávce — vyberete si na pokladně");
  return min > 0
    ? tr("Sleva {amount} při nákupu od {min}", { amount: price(Number(item.value)), min: price(min) })
    : tr("Sleva {amount} na další objednávku", { amount: price(Number(item.value)) });
}

/**
 * "Věrnostní program" block of Můj účet: balance and when it lapses, the reward catalogue (spend points on a
 * personal one-time coupon) and the coupons the customer already holds. Hidden while earning is switched off
 * (Settings.loyaltyEarnPercent = 0), which is also the kill switch for the whole program.
 */
export async function LoyaltySection({ email }: { email: string }) {
  const [tr, locale, settings] = await Promise.all([getTr(), getCurrentLocale(), getSettings()]);
  if (settings.loyaltyEarnPercent <= 0) return null;

  const isSk = locale === "sk";
  const dateLocale = isSk ? "sk-SK" : "cs-CZ";
  const currency = currencyForLocale(isSk ? "sk" : "cs");
  const price: Price = (czk) => formatPriceIn(czk, currency, settings.czkToEurRate);

  const [summary, rewards, coupons] = await Promise.all([
    getLoyaltySummary(email),
    listActiveRewards(),
    listPersonalCoupons(email),
  ]);
  const productIds = [...rewards.map((r) => r.giftProductId), ...coupons.map((c) => c.giftProductId)].filter((id): id is string => !!id);
  const gifts = productIds.length
    ? await prisma.product.findMany({
        where: { id: { in: productIds } },
        select: { id: true, name: true, nameSk: true, price: true, images: { orderBy: { sortOrder: "asc" }, take: 1, select: { url: true } } },
      })
    : [];
  const giftName = (id: string | null) => {
    const g = gifts.find((p) => p.id === id);
    return g ? (isSk && g.nameSk ? g.nameSk : g.name) : null;
  };
  const rewardName = (r: LoyaltyReward) => (isSk && r.nameSk ? r.nameSk : r.name);
  const pointsPer100 = settings.loyaltyEarnPercent;

  return (
    <section className="flex flex-col gap-5">
      <div>
        <h2 className="text-lg font-bold text-ink">{tr("Věrnostní program")}</h2>
        <p className="text-sm text-accent-2">
          {tr("Za každých 100 Kč nákupu získáte {n} bodů. Body měníte za odměny níže.", { n: pointsPer100 })}
        </p>
      </div>

      <div className="flex flex-col gap-1 rounded-sm border border-line bg-line/20 p-4">
        <span className="text-xs font-semibold tracking-wide text-accent-2 uppercase">{tr("Váš zůstatek")}</span>
        <span className="text-3xl font-bold text-ink">
          {summary.balance} <span className="text-base font-semibold text-accent-2">{tr("bodů")}</span>
        </span>
        {summary.expiresAt && (
          <span className="text-xs text-accent-2">
            {tr("Body je třeba využít do {date} (platí {n} měsíců od poslední aktivity).", {
              date: summary.expiresAt.toLocaleDateString(dateLocale),
              n: summary.expiryMonths,
            })}
          </span>
        )}
      </div>

      {rewards.length > 0 && (
        <ul className="grid gap-4 sm:grid-cols-2">
          {rewards.map((r) => {
            const missing = r.pointsCost - summary.balance;
            const gift = gifts.find((g) => g.id === r.giftProductId);
            const image = gift?.images[0]?.url ?? null;
            const value = gift ? Number(gift.price) : 0;
            const progress = Math.min(100, Math.round((summary.balance / r.pointsCost) * 100));
            return (
              <li key={r.id} className="flex flex-col overflow-hidden rounded-sm border border-line bg-white">
                {gift && (
                  <div className="relative aspect-[4/3] bg-[#f4f4f2]">
                    {image && (
                      <Image src={image} alt={rewardName(r)} fill sizes="(min-width: 640px) 320px, 100vw" className="object-contain p-3" />
                    )}
                    <span className="absolute top-2 right-2 rounded-full bg-ink px-3 py-1 text-xs font-bold text-white">
                      {r.pointsCost} {tr("bodů")}
                    </span>
                  </div>
                )}
                <div className="flex flex-1 flex-col gap-2 p-4">
                  <span className="font-semibold text-ink">{rewardName(r)}</span>
                  {gift ? (
                    <span className="text-sm text-accent-2">
                      {tr("Dárek zdarma k další objednávce")}
                      {value > 0 && (
                        <>
                          {" · "}
                          {tr("v hodnotě")} {price(value)}
                        </>
                      )}
                    </span>
                  ) : (
                    <span className="text-sm text-accent-2">{describe(tr, price, r, null)}</span>
                  )}
                  <div className="mt-auto flex flex-col gap-2 pt-2">
                    {missing > 0 ? (
                      <>
                        <div className="h-2 overflow-hidden rounded-full bg-line" role="progressbar" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100}>
                          <div className="h-full rounded-full bg-ok" style={{ width: `${progress}%` }} />
                        </div>
                        <span className="text-xs text-accent-2">
                          {summary.balance} / {r.pointsCost} {tr("bodů")} · {tr("Chybí vám {n} bodů", { n: missing })}
                        </span>
                      </>
                    ) : (
                      <form action={redeemLoyaltyReward} className="flex items-center justify-between gap-3">
                        {!gift && (
                          <span className="text-sm font-bold text-ink">
                            {r.pointsCost} {tr("bodů")}
                          </span>
                        )}
                        <input type="hidden" name="rewardId" value={r.id} />
                        <button
                          type="submit"
                          className="rounded-sm bg-ink px-4 py-2 text-sm font-semibold text-white hover:bg-accent"
                        >
                          {tr("Vyměnit")}
                        </button>
                      </form>
                    )}
                    <span className="text-xs text-accent-2">{tr("Platnost kuponu: {n} dní od vyměnění", { n: r.validDays })}</span>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {coupons.length > 0 && (
        <div className="flex flex-col gap-2">
          <h3 className="text-sm font-semibold text-ink">{tr("Vaše kupony")}</h3>
          <p className="text-xs text-accent-2">{tr("Kód zadejte v košíku nebo na pokladně do pole „Máte slevový kód?“.")}</p>
          <ul className="flex flex-col divide-y divide-line border-y border-line">
            {coupons.map((c: Coupon) => (
              <li key={c.id} className="flex flex-wrap items-center justify-between gap-2 py-3 text-sm">
                <div className="flex flex-col gap-0.5">
                  <span className="text-ink">{describe(tr, price, c, giftName(c.giftProductId))}</span>
                  {c.expiresAt && (
                    <span className="text-xs text-accent-2">
                      {tr("Platí do {date}", { date: c.expiresAt.toLocaleDateString(dateLocale) })}
                    </span>
                  )}
                </div>
                <CopyCoupon code={c.code} copyLabel={tr("zkopírovat")} copiedLabel={tr("zkopírováno ✓")} />
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
