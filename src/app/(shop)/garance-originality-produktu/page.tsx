import type { Metadata } from "next";
import { LegalPage } from "@/components/legal-page";

export const metadata: Metadata = {
  title: "Garance originality produktů | Gotrid Perfume",
};

export default function GaranceOriginalityPage() {
  return (
    <LegalPage title="Garance originality produktů">
      <p>Veškeré produkty nabízené na našem e-shopu jsou 100% originální.</p>
      <p>
        Spolupracujeme s ověřenými distributory a partnery v České republice a Evropské unii, díky
        čemuž vám můžeme nabídnout originální značkovou parfumerii a kosmetiku za poctivou cenu,
        bez zbytečné maloobchodní přirážky.
      </p>
      <p>Každý produkt je před odesláním pečlivě zkontrolován.</p>

      <h2>Doklady o původu zboží</h2>
      <p>
        K dispozici máme faktury a doklady o nákupu od našich dodavatelů a partnerů. Tyto
        dokumenty slouží jako potvrzení originality a legálního původu prodávaného zboží.
      </p>

      <h2>Transparentnost</h2>
      <p>
        Naším cílem je transparentní a férový prodej. Neprodáváme padělky ani neoriginální
        produkty. V případě jakýchkoliv dotazů nás můžete kontaktovat prostřednictvím e-mailu nebo
        kontaktního formuláře.
      </p>
    </LegalPage>
  );
}
