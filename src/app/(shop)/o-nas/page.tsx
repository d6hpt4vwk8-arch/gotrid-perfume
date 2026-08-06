import type { Metadata } from "next";
import Image from "next/image";
import { LegalPage } from "@/components/legal-page";

export const metadata: Metadata = {
  title: "O nás | Gotrid Perfume",
};

export default function ONasPage() {
  return (
    <LegalPage title="O nás">
      <div className="not-prose mb-2 flex flex-col items-center gap-4 sm:flex-row sm:items-start">
        <Image
          src="/o-nas-pavel.jpg"
          alt="Pavel Hrytsan, zakladatel Gotrid Perfume"
          width={800}
          height={800}
          className="h-36 w-36 shrink-0 rounded-sm border border-line object-cover sm:h-44 sm:w-44"
        />
        <p className="text-sm leading-relaxed text-ink/80">
          Jmenuji se Pavel (Pavlo) Hrytsan a Gotrid Perfume jsem založil v roce 2023.
        </p>
      </div>
      <p>
        Začínal jsem v malém — prodával jsem výprodejové a outletové parfémy: testery bez
        krabiček, flakony s mírně nižším objemem nebo jinak drobně použité kusy, vždy ale za
        opravdu dobrou cenu. Byl to spíš experiment, na kterém jsem nasbíral spoustu zkušeností
        a naučil se, jak tenhle obor skutečně funguje.
      </p>
      <p>
        Zkoušel jsem i další cesty — s kamarádem jsme třeba na čas provozovali automat na
        parfémy v obchodním centru ve Smíchově. Byl to další experiment, ze kterého jsem si
        odnesl další zkušenosti.
      </p>
      <figure className="not-prose my-2 flex flex-col items-center gap-2">
        <Image
          src="/o-nas-automat.png"
          alt="Parfémový automat Gotrid Perfume v obchodním centru ve Smíchově"
          width={1179}
          height={2074}
          className="h-auto w-full max-w-[220px] rounded-sm border border-line"
        />
        <figcaption className="text-xs text-accent-2">
          Náš parfémový automat v obchodním centru ve Smíchově
        </figcaption>
      </figure>
      <p>
        U parfumerie jsem zůstal, protože mě tahle oblast prostě baví, a obchod jsem postupně
        rozvíjel dál. Dnes už máme mnohem širší a stabilnější sortiment — parfémy i kosmetiku.
        Kromě e-shopu zásobujeme i dvě kamenné prodejny a věnujeme se velkoobchodnímu prodeji
        po celé Evropě. Pořád se ale držíme stejného principu, na kterém jsem začínal: poctivá
        cena bez zbytečné maloobchodní přirážky a 100% originální zboží přímo od distributorů.
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
