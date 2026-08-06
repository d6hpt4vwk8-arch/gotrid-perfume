import type { Metadata } from "next";
import { LegalPage } from "@/components/legal-page";

export const metadata: Metadata = {
  title: "Doprava a platba | Gotrid Perfume",
};

export default function DopravaAPlatbaPage() {
  return (
    <LegalPage title="Doprava a platba">
      <h2>1. Způsoby dopravy</h2>
      <p>
        Zboží doručujeme po celé České republice prostřednictvím ověřených dopravců. Při
        objednávce si můžete zvolit následující možnosti doručení:
      </p>
      <ul>
        <li>Zásilkovna — výdejní místo dle vašeho výběru: 79 Kč, doba doručení 2–4 pracovní dny,</li>
        <li>PPL kurýr — doručení na adresu: 90 Kč, doba doručení 2–4 pracovní dny,</li>
        <li>Balíkovna — výdejní místo: 69 Kč, doba doručení 2–4 pracovní dny.</li>
      </ul>
      <p>Doprava zdarma při objednávce nad určitou částku — přesný práh bude upřesněn.</p>

      <h2>2. Zpracování objednávky</h2>
      <p>
        Objednávky přijaté do 12:00 jsou obvykle odeslány ještě tentýž pracovní den, ostatní
        objednávky následující pracovní den.
      </p>

      <h2>3. Způsoby platby</h2>
      <ul>
        <li>Platba kartou online — rychlá a bezpečná platba (podporuje i Apple Pay a Google Pay),</li>
        <li>Bankovní převod — QR platba s údaji zaslanými po dokončení objednávky,</li>
        <li>Dobírka — platba v hotovosti při převzetí zásilky.</li>
      </ul>

      <h2>4. Důležité informace</h2>
      <p>
        O odeslání objednávky budete informováni emailem, včetně trackovacího čísla zásilky.
        V případě nepřevzetí zásilky si vyhrazujeme právo účtovat vzniklé náklady na dopravu.
      </p>

      <h2>5. Kontaktní údaje</h2>
      <p>
        Email: pavlohrytsan@gmail.com
        <br />
        Telefon: +420 735 583 527
      </p>
    </LegalPage>
  );
}
