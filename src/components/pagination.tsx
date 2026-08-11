"use client";

import Link from "next/link";
import { useState } from "react";

const INITIAL_PAGES = 9;
const REVEAL_BATCH = 9;

/**
 * Listing a page number per page (sometimes 60-70 of them) gives a customer
 * no reason to think there's anything worth digging for past the first
 * screen. Shows the first batch as real links (crawlable, back/forward-safe)
 * and reveals more in batches on click instead of dumping the whole range —
 * current page is always included in the initial batch even if it's deep in
 * the range (e.g. a direct link to ?page=40).
 */
export function Pagination({
  totalPages,
  currentPage,
  basePath,
  queryString,
}: {
  totalPages: number;
  currentPage: number;
  basePath: string;
  queryString: string;
}) {
  const [visibleCount, setVisibleCount] = useState(() => Math.max(INITIAL_PAGES, currentPage));

  if (totalPages <= 1) return null;

  const hrefFor = (page: number) => {
    const params = new URLSearchParams(queryString);
    if (page > 1) {
      params.set("page", String(page));
    } else {
      params.delete("page");
    }
    const qs = params.toString();
    return `${basePath}${qs ? `?${qs}` : ""}`;
  };

  const shown = Math.min(visibleCount, totalPages);
  const pages = Array.from({ length: shown }, (_, i) => i + 1);
  const hasMore = shown < totalPages;

  return (
    <div className="flex flex-wrap items-center justify-center gap-2 pt-4">
      {pages.map((p) => (
        <Link
          key={p}
          href={hrefFor(p)}
          className={`rounded-sm px-3 py-1 text-sm ${
            p === currentPage ? "bg-ink text-white" : "border border-line text-ink hover:border-accent"
          }`}
        >
          {p}
        </Link>
      ))}
      {hasMore && (
        <button
          type="button"
          onClick={() => setVisibleCount((c) => c + REVEAL_BATCH)}
          className="rounded-sm border border-line px-3 py-1 text-sm text-accent-2 hover:border-accent hover:text-accent"
        >
          …
        </button>
      )}
    </div>
  );
}
