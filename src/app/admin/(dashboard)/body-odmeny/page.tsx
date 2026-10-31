import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getSettings } from "@/lib/settings.server";
import { createLoyaltyReward, updateLoyaltyReward, deleteLoyaltyReward } from "@/lib/admin/actions/loyalty-rewards";
import { REWARD_COUPON_PREFIX } from "@/lib/loyalty-rewards";
import { DeleteButton } from "@/components/admin/delete-button";
import type { LoyaltyReward } from "@prisma/client";

const TYPE_LABELS = { FIXED: "Sleva v Kč", FREE_SHIPPING: "Doprava zdarma", GIFT: "Dárek zdarma" } as const;

function RewardFields({ reward, giftCode }: { reward?: LoyaltyReward; giftCode?: string }) {
  const input = "rounded border border-line px-2 py-1";
  return (
    <>
      <label className="flex flex-col gap-1">
        Název
        <input name="name" required defaultValue={reward?.name} className={`w-52 ${input}`} />
      </label>
      <label className="flex flex-col gap-1">
        Název (SK)
        <input name="nameSk" defaultValue={reward?.nameSk ?? ""} className={`w-44 ${input}`} />
      </label>
      <label className="flex flex-col gap-1">
        Cena (body)
        <input name="pointsCost" type="number" required defaultValue={reward?.pointsCost ?? 1000} className={`w-20 ${input}`} />
      </label>
      <label className="flex flex-col gap-1">
        Typ
        <select name="type" defaultValue={reward?.type ?? "FREE_SHIPPING"} className={input}>
          {Object.entries(TYPE_LABELS).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1">
        Sleva (Kč)
        <input name="value" type="number" step="0.01" defaultValue={reward ? Number(reward.value) : 0} className={`w-20 ${input}`} />
      </label>
      <label className="flex flex-col gap-1">
        Min. objednávka (Kč)
        <input name="minOrderValue" type="number" step="0.01" defaultValue={reward?.minOrderValue ? Number(reward.minOrderValue) : ""} className={`w-24 ${input}`} />
      </label>
      <label className="flex flex-col gap-1" title="Jen u typu Dárek zdarma. Prázdné = zákazník si vybere z běžných dárků na pokladně.">
        Kód produktu (dárek)
        <input name="giftProductCode" defaultValue={giftCode ?? ""} className={`w-36 ${input}`} />
      </label>
      <label className="flex flex-col gap-1">
        Platnost kuponu (dní)
        <input name="validDays" type="number" defaultValue={reward?.validDays ?? 60} className={`w-20 ${input}`} />
      </label>
      <label className="flex flex-col gap-1">
        Pořadí
        <input name="sortOrder" type="number" defaultValue={reward?.sortOrder ?? 0} className={`w-16 ${input}`} />
      </label>
      <label className="flex items-center gap-2 pb-1.5">
        <input type="checkbox" name="active" defaultChecked={reward?.active ?? true} />
        Aktivní
      </label>
    </>
  );
}

export default async function AdminLoyaltyRewardsPage() {
  const [rewards, settings, balances, redeemedCount] = await Promise.all([
    prisma.loyaltyReward.findMany({ orderBy: [{ sortOrder: "asc" }, { pointsCost: "asc" }] }),
    getSettings(),
    prisma.loyaltyTransaction.aggregate({ _sum: { points: true } }),
    prisma.coupon.count({ where: { code: { startsWith: REWARD_COUPON_PREFIX } } }),
  ]);
  const giftIds = rewards.map((r) => r.giftProductId).filter((id): id is string => !!id);
  const products = giftIds.length ? await prisma.product.findMany({ where: { id: { in: giftIds } }, select: { id: true, code: true, name: true } }) : [];
  const codeOf = (id: string | null) => products.find((p) => p.id === id)?.code;

  return (
    <div className="flex flex-col gap-8">
      <h1 className="text-2xl font-bold text-ink">Body a odměny</h1>

      <div className="rounded-sm border border-line bg-white p-4 text-sm text-ink">
        <p>
          Body se zákazníkům připisují jen s účtem (registrací). Teď: <strong>{settings.loyaltyEarnPercent} bodů za každých 100 Kč</strong> zboží
          (0 = program vypnutý a skrytý v Můj účet), body propadají po <strong>{settings.loyaltyExpiryMonths} měsících</strong> bez aktivity.
          Změníte to v <Link href="/admin/nastaveni" className="underline">Nastavení</Link>.
        </p>
        <p className="mt-1 text-xs text-accent-2">
          Všem zákazníkům dohromady zbývá {balances._sum.points ?? 0} bodů; vyměněno kuponů celkem: {redeemedCount}.
          Odměna se vyměňuje za osobní jednorázový kupon (BODY-…), který zákazník najde v Můj účet.
        </p>
      </div>

      <ul className="flex flex-col gap-3">
        {rewards.map((r) => (
          <li key={r.id} className="rounded-sm border border-line bg-white p-4">
            <form action={updateLoyaltyReward.bind(null, r.id)} className="flex flex-wrap items-end gap-3 text-sm">
              <RewardFields reward={r} giftCode={codeOf(r.giftProductId)} />
              <button type="submit" className="text-xs text-accent-2 underline">
                Uložit
              </button>
              <span className="ml-auto">
                <DeleteButton action={deleteLoyaltyReward.bind(null, r.id)} confirmMessage={`Smazat odměnu "${r.name}"? Už vyměněné kupony zůstanou.`} />
              </span>
            </form>
          </li>
        ))}
        {rewards.length === 0 && <li className="text-sm text-accent-2">Zatím žádné odměny — přidejte první níže.</li>}
      </ul>

      <section className="flex flex-col gap-3 rounded-sm border border-line bg-white p-4">
        <h2 className="text-sm font-semibold">Nová odměna</h2>
        <form action={createLoyaltyReward} className="flex flex-wrap items-end gap-3 text-sm">
          <RewardFields />
          <button type="submit" className="rounded-sm bg-ink px-4 py-1.5 text-sm font-semibold text-white hover:bg-accent">
            Přidat
          </button>
        </form>
      </section>
    </div>
  );
}
