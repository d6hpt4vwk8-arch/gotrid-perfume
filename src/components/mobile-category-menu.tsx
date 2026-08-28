"use client";

import Link from "next/link";
import { useState } from "react";
import type { CategoryNavNode } from "@/lib/categories.server";

// Mobile-only replacement for the horizontally-scrolling category row in
// SiteHeader (desktop keeps that row — it wraps fine at that width). The
// scroll row gave no visual hint more categories existed off-screen, so
// visitors saw 3-4 pills and assumed that was the whole catalog.
export function MobileCategoryMenu({ categories }: { categories: CategoryNavNode[] }) {
  const [open, setOpen] = useState(false);
  const visible = categories.filter((c) => !c.hidden);

  return (
    <div className="relative order-4 w-full sm:hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-2 border-t border-white/10 pt-3 text-sm font-medium text-white"
        aria-expanded={open}
      >
        Kategorie
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.8}
          className={`h-4 w-4 transition-transform ${open ? "rotate-180" : ""}`}
          aria-hidden
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
        </svg>
      </button>

      {open && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setOpen(false)}
            aria-hidden
          />
          <div className="absolute inset-x-0 top-full z-50 flex flex-col gap-1 border-t border-white/10 bg-ink py-2 shadow-lg">
            {visible.map((category) => (
              <Link
                key={category.id}
                href={`/kategorie/${category.fullSlug}`}
                onClick={() => setOpen(false)}
                className="px-1 py-2 text-sm font-medium text-white/70 hover:text-white"
              >
                {category.name}
              </Link>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
