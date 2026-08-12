"use client";

import { useState } from "react";

// No embeddable widget wired up yet — Česká pošta's Balíkovna pickup-point
// picker isn't a generic third-party JS widget like Packeta's; it ships as a
// platform-specific plugin (e.g. Shoptet) that isn't usable here. Until real
// developer/API docs for a custom-site integration are obtained, customers
// enter their chosen pobočka manually (name + address, looked up on
// ceskaposta.cz) — same fallback shape as ZasilkovnaPicker without a Packeta key.
export function BalikovnaPicker({
  selectedPointName,
  onSelect,
}: {
  selectedPointName: string | null;
  onSelect: (point: { id: string; name: string }) => void;
}) {
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");

  return (
    <div className="flex flex-col gap-2 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm">
      <p className="text-amber-800">
        Vyberte si Balíkovnu nebo pobočku České pošty na{" "}
        <a
          href="https://www.postaonline.cz/vyhledavani-postovnich-mist"
          target="_blank"
          rel="noreferrer"
          className="underline"
        >
          postaonline.cz
        </a>{" "}
        a zadejte její název a adresu níže. Na uvedený telefon vám přijde SMS s kódem pro vyzvednutí.
      </p>
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Název Balíkovny / pobočky"
        className="rounded border border-neutral-300 px-2 py-1"
      />
      <input
        value={address}
        onChange={(e) => setAddress(e.target.value)}
        placeholder="Adresa"
        className="rounded border border-neutral-300 px-2 py-1"
      />
      <button
        type="button"
        disabled={!name || !address}
        onClick={() => onSelect({ id: address, name: `${name}, ${address}` })}
        className="rounded-sm bg-ink px-3 py-1.5 text-white hover:bg-accent disabled:bg-line disabled:text-accent-2"
      >
        Potvrdit výdejní místo
      </button>
      {selectedPointName && <p className="text-ink/80">Vybráno: {selectedPointName}</p>}
    </div>
  );
}
