import type { Metadata } from "next";
import { LegalPage } from "@/components/legal-page";

export const metadata: Metadata = {
  title: "Podmínky vrácení zboží | Gotrid Perfume",
};

export default function PodminkyVraceniZboziPage() {
  return (
    <LegalPage title="Podmínky vrácení zboží">
      <h2>1. Právo na odstoupení od smlouvy</h2>
      <p>
        Kupující má právo odstoupit od kupní smlouvy bez udání důvodu do 14 dnů ode dne převzetí
        zboží. Pro dodržení lhůty je nutné odeslat oznámení o odstoupení od smlouvy před jejím
        uplynutím.
      </p>

      <h2>2. Podmínky vrácení zboží</h2>
      <p>Aby bylo možné zboží vrátit, musí splňovat následující podmínky:</p>
      <ul>
        <li>zboží nesmí být použité,</li>
        <li>musí být nepoškozené,</li>
        <li>musí být vráceno v původním obalu,</li>
        <li>musí být kompletní (včetně příslušenství, pokud je součástí).</li>
      </ul>

      <h2>3. Výjimky z odstoupení</h2>
      <p>Odstoupení od smlouvy není možné v případě:</p>
      <ul>
        <li>zboží upraveného podle přání zákazníka,</li>
        <li>zboží podléhajícího rychlé zkáze,</li>
        <li>
          zboží v uzavřeném obalu, které bylo po dodání otevřeno a z hygienických důvodů jej nelze
          vrátit.
        </li>
      </ul>
      <p>
        To se vztahuje zejména na parfémy a kosmetiku, pokud byl porušen ochranný obal nebo byl
        produkt použit.
      </p>

      <h2>4. Vadné nebo nesprávné zboží</h2>
      <p>
        V případě, že obdržíte poškozené zboží nebo zboží, které neodpovídá objednávce,
        kontaktujte nás co nejdříve po převzetí zásilky. Doporučujeme zkontrolovat zásilku ihned
        při doručení. V takovém případě hradí náklady na vrácení prodávající.
      </p>

      <h2>5. Postup při vrácení</h2>
      <p>
        Pro vrácení zboží nás prosím kontaktujte na emailu pavlohrytsan@gmail.com. Uveďte číslo
        objednávky a důvod vrácení (není povinný). Po domluvě zašlete zboží na adresu:
      </p>
      <p>
        Pavlo Hrytsan
        <br />
        Na Jarově 2425/4
        <br />
        130 00 Praha 3 – Žižkov
        <br />
        Česká republika
      </p>

      <h2>6. Náklady na vrácení</h2>
      <p>
        Kupující nese náklady spojené s vrácením zboží v případě odstoupení od smlouvy bez udání
        důvodu. V případě vadného nebo nesprávného zboží hradí náklady na vrácení prodávající.
      </p>

      <h2>7. Vrácení peněz</h2>
      <p>
        Po obdržení a kontrole vráceného zboží vrátíme peněžní prostředky nejpozději do 14 dnů, a
        to stejným způsobem, jakým byly přijaty, pokud se nedohodneme jinak. Prodávající není
        povinen vrátit peněžní prostředky dříve, než obdrží vrácené zboží nebo než kupující
        prokáže, že zboží odeslal.
      </p>

      <h2>8. Výměna zboží</h2>
      <p>
        V případě zájmu o výměnu zboží nás prosím kontaktujte emailem. Výměna je řešena
        individuálně dle dostupnosti zboží.
      </p>

      <h2>9. Kontaktní údaje</h2>
      <p>
        Internetový obchod: Gotrid Perfume
        <br />
        Email: pavlohrytsan@gmail.com
        <br />
        Telefon: +420 735 583 527
      </p>
    </LegalPage>
  );
}
