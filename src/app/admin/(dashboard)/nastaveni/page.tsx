import { getSettings } from "@/lib/settings.server";
import { updateSettings } from "@/lib/admin/actions/settings";

export default async function AdminSettingsPage() {
  const settings = await getSettings();

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
          Příplatek za dobírku (Kč)
          <input
            name="codSurcharge"
            type="number"
            step="0.01"
            defaultValue={settings.codSurcharge}
            className="rounded-sm border border-line px-3 py-2"
          />
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
