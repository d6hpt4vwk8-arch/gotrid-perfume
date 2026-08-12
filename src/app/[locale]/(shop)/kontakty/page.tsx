import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Kontakty | Gotrid Perfume",
};

export default function KontaktyPage() {
  return (
    <main className="mx-auto flex max-w-3xl flex-1 flex-col gap-8 px-4 py-10">
      <h1 className="text-2xl font-bold text-ink">Kontakty</h1>

      <div className="grid gap-8 sm:grid-cols-2">
        <div className="flex flex-col gap-2 text-sm text-ink">
          <p>
            <strong>Pavlo Hrytsan</strong>
          </p>
          <p>Na Jarově 2425/4, 130 00 Praha 3-Žižkov</p>
          <p>IČO: 19296037</p>
          <p>
            <a href="mailto:pavlohrytsan@gmail.com" className="hover:text-accent hover:underline">
              pavlohrytsan@gmail.com
            </a>
          </p>
          <p>+420 735 583 527</p>
          <p className="pt-2 text-accent-2">
            Zákaznická podpora: Po–Pá 9:00–18:00
            <br />
            Objednávky přijímáme 24/7
          </p>
        </div>

        <p className="text-sm text-ink/70">
          Máte nějaké otázky? Napište nám na{" "}
          <a href="mailto:pavlohrytsan@gmail.com" className="text-ink underline hover:text-accent">
            pavlohrytsan@gmail.com
          </a>{" "}
          nebo zavolejte na +420 735 583 527 — rádi vám odpovíme.
        </p>
      </div>
    </main>
  );
}
