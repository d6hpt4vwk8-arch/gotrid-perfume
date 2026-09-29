import type { Metadata } from "next";
import { LegalPage } from "@/components/legal-page";

export const metadata: Metadata = {
  title: "Garance originality produktů | Gotrid Perfume",
};

export default function GaranceOriginalityPage() {
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
