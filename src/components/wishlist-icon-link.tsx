"use client";

import Link from "next/link";
import { useWishlist } from "@/lib/wishlist-context";

export function WishlistIconLink() {
  const { count } = useWishlist();

  return (
    <Link href="/oblibene" className="relative flex items-center gap-1.5 text-sm font-medium">
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.8}
        className="h-5 w-5"
        aria-hidden
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12Z"
        />
      </svg>
      Oblíbené
      {count > 0 && (
        <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-white px-1 text-xs font-semibold text-ink">
          {count}
        </span>
      )}
    </Link>
  );
}
