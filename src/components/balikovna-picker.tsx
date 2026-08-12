"use client";

import { useEffect, useRef, useState } from "react";

interface BalikovnaResult {
  id: string;
  name: string;
  address: string;
  kind: string;
  city: string;
  distanceKm?: number;
}

// Real nearby-point picker (search by city/address, or "use my location"),
// same idea as ZasilkovnaPicker's widget — but backed by our own
// BalikovnaPoint table instead of a third-party JS widget, since Balíkovna
// has none for custom sites. Data comes from Česká pošta's own e-shop feed
// (see scripts/sync-balikovna-points.ts), not a live third-party call.
export function BalikovnaPicker({
  selectedPointName,
  onSelect,
}: {
  selectedPointName: string | null;
  onSelect: (point: { id: string; name: string }) => void;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<BalikovnaResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (query.trim().length < 2) {
      setResults([]);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/balikovna/search?q=${encodeURIComponent(query.trim())}`);
        const data = await res.json();
        setResults(data.points ?? []);
      } catch {
        setError("Vyhledávání se nezdařilo, zkuste to prosím znovu.");
      } finally {
        setLoading(false);
      }
    }, 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query]);

  function useMyLocation() {
    if (!navigator.geolocation) {
      setError("Váš prohlížeč nepodporuje zjištění polohy.");
      return;
    }
    setLoading(true);
    setError(null);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const res = await fetch(
            `/api/balikovna/search?lat=${pos.coords.latitude}&lng=${pos.coords.longitude}`,
          );
          const data = await res.json();
          setQuery("");
          setResults(data.points ?? []);
        } catch {
          setError("Vyhledávání se nezdařilo, zkuste to prosím znovu.");
        } finally {
          setLoading(false);
        }
      },
      () => {
        setError("Polohu se nepodařilo zjistit, povolte prosím přístup nebo zadejte obec ručně.");
        setLoading(false);
      },
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex gap-2">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Zadejte obec, ulici nebo PSČ"
          className="flex-1 rounded-sm border border-line px-3 py-2 text-sm text-ink"
        />
        <button
          type="button"
          onClick={useMyLocation}
          className="shrink-0 rounded-sm border border-line px-3 py-2 text-sm font-medium text-ink hover:border-accent hover:text-accent"
        >
          Moje poloha
        </button>
      </div>

      {loading && <p className="text-sm text-accent-2">Hledám…</p>}
      {error && <p className="text-sm text-red-600">{error}</p>}

      {results.length > 0 && (
        <ul className="flex max-h-64 flex-col gap-1 overflow-y-auto rounded-sm border border-line">
          {results.map((p) => (
            <li key={p.id}>
              <button
                type="button"
                onClick={() => onSelect({ id: p.id, name: `${p.name}, ${p.address}` })}
                className="flex w-full flex-col gap-0.5 border-b border-line px-3 py-2 text-left text-sm last:border-b-0 hover:bg-line/30"
              >
                <span className="font-medium text-ink">
                  {p.name}
                  {typeof p.distanceKm === "number" && (
                    <span className="ml-2 text-xs font-normal text-accent-2">
                      {p.distanceKm < 1
                        ? `${Math.round(p.distanceKm * 1000)} m`
                        : `${p.distanceKm.toFixed(1)} km`}
                    </span>
                  )}
                </span>
                <span className="text-accent-2">{p.address}</span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {selectedPointName && <p className="text-sm text-ink/80">Vybráno: {selectedPointName}</p>}
    </div>
  );
}
