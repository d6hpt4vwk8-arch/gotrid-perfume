import type { Metadata } from "next";
import { LegalPage } from "@/components/legal-page";
import { getCurrentLocale, getTr } from "@/i18n/tr.server";
import { ZarukaOriginalitySk } from "@/content-sk/legal-sk";
import { localeAlternates } from "@/lib/seo";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const tr = await getTr();
  return {
    title: `${tr("Garance originality produktů")} | Gotrid Perfume`,
    alternates: localeAlternates(locale, "/garance-originality-produktu"),
  };
}

export default async function GaranceOriginalityPage() {
  const [tr, locale] = await Promise.all([getTr(), getCurrentLocale()]);
  if (locale === "sk") {
    return (
      <LegalPage title={tr("Garance originality produktů")}>
        <ZarukaOriginalitySk />
      </LegalPage>
    );
  }
  return (
    <LegalPage title="Garance originality produktů">
      <p>
        Zboží nakupujeme přímo od ověřených distributorů a partnerů v České republice a Evropské
        unii, díky čemuž vám můžeme nabídnout značkovou parfumerii a kosmetiku za poctivou cenu,
        bez zbytečné maloobchodní přirážky.
      </p>
      <p>Každý produkt je před odesláním pečlivě zkontrolován.</p>

      <h2>Doklady o původu zboží</h2>
      <p>
        K dispozici máme faktury a doklady o nákupu od našich dodavatelů a partnerů, které
        potvrzují legální původ prodávaného zboží.
      </p>

      <h2>Transparentnost</h2>
      <p>
        Naším cílem je transparentní a férový prodej. V případě jakýchkoliv dotazů nás můžete
        kontaktovat prostřednictvím e-mailu nebo kontaktního formuláře.
      </p>
    </LegalPage>
  );
}
