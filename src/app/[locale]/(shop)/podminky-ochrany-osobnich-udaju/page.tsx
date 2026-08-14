import type { Metadata } from "next";
import { LegalPage } from "@/components/legal-page";

export const metadata: Metadata = {
  title: "Podmínky ochrany osobních údajů | Gotrid Perfume",
};

export default function OchranaOsobnichUdajuPage() {
  return (
    <LegalPage title="Podmínky ochrany osobních údajů">
      <h2>I. Základní ustanovení</h2>
      <p>
        1. Správcem osobních údajů podle čl. 4 bod 7 nařízení Evropského parlamentu a Rady (EU)
        2016/679 (dále jen „GDPR“) je Pavlo Hrytsan, IČ 19296037, se sídlem Na Jarově 2425/4, 130 00
        Praha 3-Žižkov (dále jen „správce“).
      </p>
      <p>
        2. Kontaktní údaje správce: Gotrid Perfume, www.gotridperfume.cz, email
        pavlohrytsan@gmail.com, telefon +420 735 583 527.
      </p>
      <p>
        3. Osobními údaji se rozumí veškeré informace o identifikované nebo identifikovatelné
        fyzické osobě.
      </p>

      <h2>II. Zdroje a kategorie zpracovávaných osobních údajů</h2>
      <p>
        Správce zpracovává osobní údaje, které jste mu poskytl/a, nebo které získal na základě
        plnění vaší objednávky — identifikační a kontaktní údaje a údaje nezbytné pro plnění
        smlouvy.
      </p>

      <h2>III. Zákonný důvod a účel zpracování osobních údajů</h2>
      <p>Zákonným důvodem zpracování je:</p>
      <ul>
        <li>plnění smlouvy mezi vámi a správcem podle čl. 6 odst. 1 písm. b) GDPR,</li>
        <li>
          oprávněný zájem správce na poskytování přímého marketingu podle čl. 6 odst. 1 písm. f)
          GDPR,
        </li>
        <li>
          váš souhlas se zpracováním pro účely přímého marketingu podle čl. 6 odst. 1 písm. a) GDPR
          ve spojení s § 7 odst. 2 zákona č. 480/2004 Sb., nedošlo-li k objednávce zboží nebo
          služby.
        </li>
      </ul>
      <p>
        Účelem zpracování je vyřízení objednávky a výkon práv a povinností ze smluvního vztahu, a
        zasílání obchodních sdělení. Ze strany správce nedochází k automatickému individuálnímu
        rozhodování ve smyslu čl. 22 GDPR.
      </p>

      <h2>IV. Doba uchovávání údajů</h2>
      <p>
        Správce uchovává osobní údaje po dobu nezbytnou k výkonu práv a povinností ze smluvního
        vztahu a uplatňování nároků z něj (15 let od ukončení vztahu), a po dobu trvání souhlasu se
        zpracováním pro marketing (nejdéle 5 let). Po uplynutí doby uchovávání správce osobní údaje
        vymaže.
      </p>

      <h2>V. Příjemci osobních údajů</h2>
      <p>Příjemci osobních údajů jsou osoby:</p>
      <ul>
        <li>podílející se na dodání zboží a realizaci plateb na základě smlouvy,</li>
        <li>zajišťující provoz e-shopu a související služby,</li>
        <li>zajišťující marketingové služby.</li>
      </ul>
      <p>
        Správce má v úmyslu předat osobní údaje do třetí země (mimo EU) — příjemci ve třetích
        zemích jsou poskytovatelé mailingových a cloudových služeb.
      </p>

      <h2>VI. Vaše práva</h2>
      <p>Za podmínek stanovených v GDPR máte právo na:</p>
      <ul>
        <li>přístup ke svým osobním údajům (čl. 15 GDPR),</li>
        <li>opravu osobních údajů, popř. omezení zpracování (čl. 16, 18 GDPR),</li>
        <li>výmaz osobních údajů (čl. 17 GDPR),</li>
        <li>vznesení námitky proti zpracování (čl. 21 GDPR),</li>
        <li>přenositelnost údajů (čl. 20 GDPR),</li>
        <li>odvolání souhlasu se zpracováním písemně nebo elektronicky na kontakty správce.</li>
      </ul>
      <p>
        Dále máte právo podat stížnost u Úřadu pro ochranu osobních údajů, domníváte-li se, že
        bylo porušeno vaše právo na ochranu osobních údajů.
      </p>

      <h2>VII. Podmínky zabezpečení osobních údajů</h2>
      <p>
        Správce přijal vhodná technická a organizační opatření k zabezpečení osobních údajů,
        včetně zabezpečení přístupů hesly, šifrování komunikace (SSL) a omezení přístupu k údajům
        pouze pověřeným osobám.
      </p>

      <h2>VIII. Cookies</h2>
      <p>
        Webové stránky používají cookies pro zajištění správného fungování, analýzu návštěvnosti a
        marketing. Používání analytických a marketingových cookies (Meta Pixel) je založeno na
        souhlasu uděleném prostřednictvím cookie lišty a lze jej kdykoliv odvolat.
      </p>

      <h2>IX. Závěrečná ustanovení</h2>
      <p>
        Odesláním objednávky nebo zaškrtnutím souhlasu prostřednictvím formuláře potvrzujete, že
        jste seznámen/a s těmito podmínkami a v celém rozsahu je přijímáte. Správce je oprávněn
        tyto podmínky změnit; novou verzi zveřejní na webu a zašle na email uvedený správci.
      </p>
    </LegalPage>
  );
}
