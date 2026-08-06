import type { Metadata } from "next";
import { LegalPage } from "@/components/legal-page";

export const metadata: Metadata = {
  title: "O nás | Gotrid Perfume",
};

export default function ONasPage() {
  return (
    <LegalPage title="O nás">
      <p>
        Gotrid Perfume je internetový obchod zaměřený na prodej parfémů a kosmetiky. Naším cílem
        je nabídnout zákazníkům originální značkové produkty za poctivou cenu, bez zbytečné
        maloobchodní přirážky, a zajistit jednoduchý a pohodlný nákup.
      </p>
      <p>
        Projekt byl založen v roce 2024. Začínali jsme jako menší prodej prostřednictvím
        sociálních sítí, především na Instagramu. Postupně jsme rozšířili naši činnost a vytvořili
        plnohodnotný internetový obchod, abychom mohli nabídnout lepší služby a širší sortiment.
      </p>
      <p>
        Spolupracujeme s ověřenými distributory a partnery, díky čemuž můžeme nabídnout zajímavý
        výběr parfémů a kosmetiky různých značek za dostupnější ceny — vždy se zárukou originality.
      </p>

      <h2>Co nabízíme</h2>
      <ul>
        <li>parfémy a kosmetiku předních značek,</li>
        <li>100% originální produkty s garancí originality,</li>
        <li>pravidelně aktualizovaný sortiment.</li>
      </ul>

      <h2>Jak fungujeme</h2>
      <p>
        Zboží pečlivě vybíráme a kontrolujeme před odesláním. Objednávky zpracováváme co
        nejrychleji, aby bylo doručení v co nejkratším čase.
      </p>

      <h2>Kontakt</h2>
      <p>
        Email: pavlohrytsan@gmail.com
        <br />
        Telefon: +420 735 583 527
        <br />
        Adresa: Na Jarově 2425/4, 130 00 Praha 3 – Žižkov, Česká republika
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
