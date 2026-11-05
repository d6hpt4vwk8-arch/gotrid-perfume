import type { Metadata } from "next";
import { CONTACT, currentSeller } from "@/lib/business-identity";
import { PICKUP_ADDRESS } from "@/lib/shipping";
import { Link } from "@/i18n/navigation";
import { LegalPage } from "@/components/legal-page";
import { getCurrentLocale, getTr } from "@/i18n/tr.server";
import { ONasSk } from "@/content-sk/legal-sk";
import { localeAlternates } from "@/lib/seo";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const tr = await getTr();
  return { title: `${tr("O nás")} | Gotrid Perfume`, alternates: localeAlternates(locale, "/o-nas") };
}

export default async function ONasPage() {
  const [tr, locale] = await Promise.all([getTr(), getCurrentLocale()]);
  const seller = currentSeller();
  if (locale === "sk") {
    return (
      <LegalPage title={tr("O nás")}>
        <ONasSk seller={seller} register={seller.commercialRegister ? tr(seller.commercialRegister) : null} />
      </LegalPage>
    );
  }
  return (
    <LegalPage title="O nás">
      <p>
        Gotrid Perfume provozuje společnost {seller.legalName}, IČO {seller.ico}, se sídlem {seller.street},{" "}
        {seller.city}. Specializujeme se na arabské parfémy a korejskou kosmetiku. V nabídce najdete také další
        parfémy, péči o pleť, tělo a vlasy, péči o zuby, vonné svíčky, difuzéry a vůně do auta.
      </p>

      <h2>Odkud zboží pochází</h2>
      <p>
        Zboží nakupujeme od ověřených distributorů v České republice a Evropské unii a odesíláme ho z našeho
        skladu v Praze. Ke dodávkám máme nákupní doklady a na požádání rádi doložíme původ konkrétního produktu —
        stačí napsat na {CONTACT.email}. Podrobnosti najdete na stránce{" "}
        <Link href="/garance-originality-produktu">Garance originality produktů</Link>.
      </p>

      <h2>Jak nakupovat</h2>
      <p>
        Objednávky zpracováváme co nejrychleji a zboží před odesláním kontrolujeme. Možnosti{" "}
        <Link href="/doprava-a-platba">dopravy a platby</Link> i{" "}
        <Link href="/podminky-vraceni-zbozi">podmínky vrácení zboží</Link> (14 dní) jsou popsané na samostatných
        stránkách.
      </p>

      <h2>Kontakt</h2>
      <p>
        {seller.legalName}, IČO {seller.ico}
        {seller.dic ? `, DIČ ${seller.dic}` : ""}
        <br />
        {seller.commercialRegister}
        <br />
        Email: {CONTACT.email}
        <br />
        Telefon: {CONTACT.phone}
        <br />
        Sklad a adresa pro vrácení zboží: {PICKUP_ADDRESS}, Česká republika
      </p>

      <h2>Provozní doba</h2>
      <p>
        Po–Pá: 9:00–18:00
        <br />
        So–Ne: zavřeno
      </p>
    </LegalPage>
  );
}
