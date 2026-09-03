import { prisma } from "@/lib/prisma";
import { getSettings } from "@/lib/settings.server";
import { updateSettings } from "@/lib/admin/actions/settings";

export default async function AdminSettingsPage() {
  const [settings, raw] = await Promise.all([
    getSettings(),
    prisma.settings.upsert({ where: { id: "singleton" }, update: {}, create: { id: "singleton" } }),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold text-ink">Nastavení dopravy a plateb</h1>

      <form action={updateSettings} className="flex max-w-md flex-col gap-4 rounded-sm border border-line bg-white p-4">
        <label className="flex flex-col gap-1 text-sm">
          Práh pro dopravu zdarma (Kč)
          <input
            name="freeShippingThreshold"
            type="number"
            step="0.01"
            defaultValue={settings.freeShippingThreshold}
            className="rounded-sm border border-line px-3 py-2"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Zásilkovna — výdejní místo (Kč)
          <input
            name="shippingPriceZasilkovna"
            type="number"
            step="0.01"
            defaultValue={settings.shippingPrices.ZASILKOVNA}
            className="rounded-sm border border-line px-3 py-2"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Zásilkovna — Slovensko (Kč)
          <input
            name="shippingPriceZasilkovnaSk"
            type="number"
            step="0.01"
            defaultValue={settings.shippingPriceZasilkovnaSk ?? ""}
            className="rounded-sm border border-line px-3 py-2"
          />
          <span className="text-xs text-accent-2">
            Nechte prázdné, dokud nepotvrdíte cenu — do té doby se pro Slovensko použije stejná
            cena jako pro ČR.
          </span>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          PPL kurýr (Kč)
          <input
            name="shippingPricePpl"
            type="number"
            step="0.01"
            defaultValue={settings.shippingPrices.PPL}
            className="rounded-sm border border-line px-3 py-2"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          DPD kurýr (Kč)
          <input
            name="shippingPriceDpd"
            type="number"
            step="0.01"
            defaultValue={settings.shippingPrices.DPD}
            className="rounded-sm border border-line px-3 py-2"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Balíkovna (Kč)
          <input
            name="shippingPriceBalikovna"
            type="number"
            step="0.01"
            defaultValue={settings.shippingPrices.BALIKOVNA}
            className="rounded-sm border border-line px-3 py-2"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          GLS kurýr (Kč)
          <input
            name="shippingPriceGls"
            type="number"
            step="0.01"
            defaultValue={settings.shippingPrices.GLS}
            className="rounded-sm border border-line px-3 py-2"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Příplatek za dobírku (Kč)
          <input
            name="codSurcharge"
            type="number"
            step="0.01"
            defaultValue={settings.codSurcharge}
            className="rounded-sm border border-line px-3 py-2"
          />
        </label>
        <div className="mt-2 border-t border-line pt-4 text-xs font-semibold uppercase text-accent-2">
          E-mail „druhá objednávka“
        </div>
        <label className="flex flex-col gap-1 text-sm">
          Odeslat po (dnech od první objednávky)
          <input
            name="secondOrderDelayDays"
            type="number"
            step="1"
            min="1"
            defaultValue={raw.secondOrderDelayDays}
            className="rounded-sm border border-line px-3 py-2"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Výše slevy (%)
          <input
            name="secondOrderDiscountPercent"
            type="number"
            step="1"
            min="1"
            max="90"
            defaultValue={raw.secondOrderDiscountPercent}
            className="rounded-sm border border-line px-3 py-2"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Předpona kódu
          <input
            name="secondOrderCouponPrefix"
            defaultValue={raw.secondOrderCouponPrefix}
            className="rounded-sm border border-line px-3 py-2"
          />
          <span className="text-xs text-accent-2">
            Každý e-mail dostane vlastní jednorázový kód (např. {raw.secondOrderCouponPrefix}
            X7K2Q9) — funguje jen jednou, nedá se sdílet ani používat opakovaně.
          </span>
        </label>
        <button
          type="submit"
          className="w-fit rounded-sm bg-ink px-5 py-2.5 text-sm font-medium text-white hover:bg-accent"
        >
          Uložit nastavení
        </button>
      </form>
    </div>
  );
}
