import type { Metadata } from "next";
import { currentSeller, CONTACT } from "@/lib/business-identity";

export const metadata: Metadata = {
  title: "Kontakty | Gotrid Perfume",
};

export default function KontaktyPage() {
  const seller = currentSeller();

  return (
    <main className="mx-auto flex max-w-3xl flex-1 flex-col gap-8 px-4 py-10">
      <h1 className="text-2xl font-bold text-ink">Kontakty</h1>

      <div className="grid gap-8 sm:grid-cols-2">
        <div className="flex flex-col gap-2 text-sm text-ink">
          <p>
            <strong>{seller.legalName}</strong>
          </p>
          <p>
            {seller.street}, {seller.city}
          </p>
          <p>IČO: {seller.ico}</p>
          {seller.dic && <p>DIČ: {seller.dic}</p>}
          <p>
            <a href={`mailto:${CONTACT.email}`} className="hover:text-accent hover:underline">
              {CONTACT.email}
            </a>
          </p>
          <p>{CONTACT.phone}</p>
          <p className="pt-2 text-accent-2">
            Zákaznická podpora: {CONTACT.supportHours}
            <br />
            Objednávky přijímáme 24/7
          </p>
        </div>

        <p className="text-sm text-ink/70">
          Máte nějaké otázky? Napište nám na{" "}
          <a href={`mailto:${CONTACT.email}`} className="text-ink underline hover:text-accent">
            {CONTACT.email}
          </a>{" "}
          nebo zavolejte na {CONTACT.phone} — rádi vám odpovíme.
        </p>
      </div>
    </main>
  );
}
