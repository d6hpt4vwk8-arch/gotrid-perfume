"use client";

import { useEffect, useState } from "react";

interface PacketaPoint {
  id: string;
  name: string;
  street?: string;
  city?: string;
  zip?: string;
}

declare global {
  interface Window {
    Packeta?: {
      Widget: {
        pick: (
          apiKey: string,
          callback: (point: PacketaPoint | null) => void,
          options?: Record<string, unknown>,
        ) => void;
      };
    };
  }
}

const WIDGET_SRC = "https://widget.packeta.com/v6/www/js/library.js";
const apiKey = process.env.NEXT_PUBLIC_PACKETA_API_KEY;

function loadWidgetScript(): Promise<void> {
  if (window.Packeta) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[src="${WIDGET_SRC}"]`);
    if (existing) {
      existing.addEventListener("load", () => resolve());
      return;
    }
    const script = document.createElement("script");
    script.src = WIDGET_SRC;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Nepodařilo se načíst widget Zásilkovny."));
    document.body.appendChild(script);
  });
}

export function ZasilkovnaPicker({
  selectedPointName,
  onSelect,
}: {
  selectedPointName: string | null;
  onSelect: (point: { id: string; name: string }) => void;
}) {
  const [manualId, setManualId] = useState("");
  const [manualName, setManualName] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (apiKey) loadWidgetScript().catch((err) => setError(err.message));
  }, []);

  if (!apiKey) {
    // Fallback until the owner supplies a Packeta API key (TZ §12.4) — keeps
    // checkout usable in the meantime via manual pickup-point entry.
    return (
      <div className="flex flex-col gap-2 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm">
        <p className="text-amber-800">
          Widget Zásilkovny zatím není nakonfigurován. Zadejte prosím výdejní místo ručně (název a
          ID najdete na{" "}
          <a
            href="https://www.zasilkovna.cz/pobocky"
            target="_blank"
            rel="noreferrer"
            className="underline"
          >
            zasilkovna.cz/pobocky
          </a>
          ).
        </p>
        <input
          value={manualName}
          onChange={(e) => setManualName(e.target.value)}
          placeholder="Název výdejního místa"
          className="rounded border border-neutral-300 px-2 py-1"
        />
        <input
          value={manualId}
          onChange={(e) => setManualId(e.target.value)}
          placeholder="ID výdejního místa"
          className="rounded border border-neutral-300 px-2 py-1"
        />
        <button
          type="button"
          disabled={!manualId || !manualName}
          onClick={() => onSelect({ id: manualId, name: manualName })}
          className="rounded-sm bg-ink px-3 py-1.5 text-white hover:bg-accent disabled:bg-line disabled:text-accent-2"
        >
          Potvrdit výdejní místo
        </button>
        {selectedPointName && (
          <p className="text-ink/80">Vybráno: {selectedPointName}</p>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        onClick={async () => {
          try {
            await loadWidgetScript();
            window.Packeta?.Widget.pick(
              apiKey,
              (point) => {
                if (point) onSelect({ id: point.id, name: point.name });
              },
              { country: "cz", language: "cs" },
            );
          } catch (err) {
            setError(err instanceof Error ? err.message : "Chyba widgetu.");
          }
        }}
        className="rounded-sm border border-line px-4 py-2 text-sm font-medium text-ink hover:border-accent hover:text-accent"
      >
        {selectedPointName ? "Změnit výdejní místo" : "Vybrat výdejní místo"}
      </button>
      {selectedPointName && (
        <p className="text-sm text-ink/80">Vybráno: {selectedPointName}</p>
      )}
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}
