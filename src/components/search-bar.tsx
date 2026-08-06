"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { formatPrice } from "@/lib/format";

interface SearchResult {
  slug: string;
  name: string;
  brand: string | null;
  price: number;
  image: string | null;
}

export function SearchBar({ dark = false }: { dark?: boolean }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length < 2) {
      setResults([]);
      return;
    }

    const controller = new AbortController();
    const timeout = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(trimmed)}`, {
          signal: controller.signal,
        });
        const data = await res.json();
        setResults(data.results ?? []);
        setOpen(true);
      } catch {
        // ignore aborted/failed requests
      }
    }, 250);

    return () => {
      clearTimeout(timeout);
      controller.abort();
    };
  }, [query]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div ref={containerRef} className="relative w-full max-w-sm">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          setOpen(false);
          router.push(`/hledat?q=${encodeURIComponent(query.trim())}`);
        }}
      >
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => results.length > 0 && setOpen(true)}
          placeholder="Hledat produkty, značky…"
          className={
            dark
              ? "w-full rounded-sm border border-white/15 bg-white/10 px-3 py-1.5 text-sm text-white placeholder-white/50 focus:border-white/40 focus:outline-none"
              : "w-full rounded-md border border-neutral-300 px-3 py-1.5 text-sm focus:border-neutral-500 focus:outline-none"
          }
        />
      </form>

      {open && results.length > 0 && (
        <div className="absolute z-20 mt-1 w-full rounded-md border border-neutral-200 bg-white shadow-lg">
          <ul className="divide-y divide-neutral-100">
            {results.map((r) => (
              <li key={r.slug}>
                <Link
                  href={`/produkt/${r.slug}`}
                  onClick={() => setOpen(false)}
                  className="flex items-center gap-3 px-3 py-2 text-sm hover:bg-neutral-50"
                >
                  <span className="relative h-10 w-10 shrink-0 overflow-hidden rounded bg-neutral-100">
                    {r.image && (
                      <Image src={r.image} alt={r.name} fill sizes="40px" className="object-cover" />
                    )}
                  </span>
                  <span className="flex flex-1 flex-col">
                    <span className="line-clamp-1">{r.name}</span>
                    {r.brand && <span className="text-xs text-neutral-400">{r.brand}</span>}
                  </span>
                  <span className="font-medium">{formatPrice(r.price)}</span>
                </Link>
              </li>
            ))}
          </ul>
          <Link
            href={`/hledat?q=${encodeURIComponent(query.trim())}`}
            onClick={() => setOpen(false)}
            className="block border-t border-neutral-100 px-3 py-2 text-center text-sm font-medium text-neutral-700 hover:bg-neutral-50"
          >
            Zobrazit všechny výsledky
          </Link>
        </div>
      )}
    </div>
  );
}
