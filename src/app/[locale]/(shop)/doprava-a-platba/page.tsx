import type { Metadata } from "next";
import { CONTACT } from "@/lib/business-identity";
import { LegalPage } from "@/components/legal-page";
import { getSettings } from "@/lib/settings.server";
import { formatPriceIn } from "@/lib/format";
import { currencyForLocale } from "@/lib/currency";
import { getCurrentLocale, getTr } from "@/i18n/tr.server";
import { DopravaPlatbaSk } from "@/content-sk/legal-sk";
import { localeAlternates } from "@/lib/seo";
import { PICKUP_ADDRESS } from "@/lib/shipping";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const tr = await getTr();
  return { title: `${tr("Doprava a platba")} | Gotrid Perfume`, alternates: localeAlternates(locale, "/doprava-a-platba") };
}

// Prices/thresholds are pulled live from Settings rather than hardcoded —
// this page previously went stale every time a carrier's price or lineup
// changed in /admin/nastaveni (still listed PPL/DPD/Balíkovna after they
// were retired from checkout).
export default async function DopravaAPlatbaPage() {
  const settings = await getSettings();
  const currency = currencyForLocale(await getCurrentLocale());
  const price = (czk: number) => formatPriceIn(czk, currency, settings.czkToEurRate);

  if ((await getCurrentLocale()) === "sk") {
    const tr = await getTr();
    return (
      <LegalPage title={tr("Doprava a platba")}>
        <DopravaPlatbaSk
          price={price}
          freeFrom={settings.freeShippingThreshold}
          codSurcharge={settings.codSurcharge}
          codLimit={settings.freeShippingThreshold}
          prices={{
            zasilkovna: settings.shippingPriceZasilkovnaSk ?? settings.shippingPrices.ZASILKOVNA,
            zasilkovnaHd: settings.shippingPrices.ZASILKOVNA_HD,
            glsMisto: settings.shippingPriceGlsMistoSk ?? settings.shippingPrices.GLS_MISTO,
            gls: settings.shippingPriceGlsSk ?? settings.shippingPrices.GLS,
          }}
        />
      </LegalPage>
    );
  }

  return (
    <LegalPage title="Doprava a platba">
      <h2>1. Způsoby dopravy</h2>
      <p>
        Zboží doručujeme po celé České republice prostřednictvím ověřených dopravců. Při
        objednávce si můžete zvolit následující možnosti doručení:
      </p>
      <ul>
        <li>
          Zásilkovna — výdejní místo dle vašeho výběru: {price(settings.shippingPrices.ZASILKOVNA)},
          doba doručení 1–3 pracovní dny,
        </li>
        <li>
          GLS — výdejní místo/box dle vašeho výběru: {price(settings.shippingPrices.GLS_MISTO)}, doba
          doručení 1–3 pracovní dny,
        </li>
        <li>
          GLS kurýr — doručení na adresu: {price(settings.shippingPrices.GLS)}, doba doručení
          1–3 pracovní dny,
        </li>
        <li>
          Osobní odběr — {PICKUP_ADDRESS}: zdarma, po předchozí domluvě termínu.
        </li>
      </ul>
      <p>
        Doprava zdarma při objednávce nad {price(settings.freeShippingThreshold)} (netýká se
        osobního odběru, který je zdarma vždy).
      </p>

      <h2>2. Zpracování objednávky</h2>
      <p>
        Objednávky přijaté do 12:00 jsou obvykle odeslány ještě tentýž pracovní den, ostatní
        objednávky následující pracovní den.
      </p>

      <h2>3. Způsoby platby</h2>
      <ul>
        <li>Platba kartou online — rychlá a bezpečná platba (podporuje i Apple Pay a Google Pay),</li>
        <li>Bankovní převod — QR platba s údaji zaslanými po dokončení objednávky,</li>
        <li>
          Dobírka — platba v hotovosti nebo kartou při převzetí zásilky (příplatek{" "}
          {price(settings.codSurcharge)}, dostupné jen do {price(settings.freeShippingThreshold)}
          ).
        </li>
      </ul>

      <h2>4. Důležité informace</h2>
      <p>
        O odeslání objednávky budete informováni emailem, včetně trackovacího čísla zásilky.
        V případě nepřevzetí zásilky si vyhrazujeme právo účtovat vzniklé náklady na dopravu.
      </p>

      <h2>5. Kontaktní údaje</h2>
      <p>
        Email: info@gotridperfume.cz
        <br />
        Telefon: {CONTACT.phone}
      </p>
    </LegalPage>
  );
}
