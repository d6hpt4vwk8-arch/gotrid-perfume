"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useCart } from "@/lib/cart-context";

export function CartIconLink() {
  const { itemCount } = useCart();
  const previousCount = useRef(itemCount);
  const [bumping, setBumping] = useState(false);

  // Visible from anywhere on the page, unlike the bottom-corner toast —
  // a second, harder-to-miss confirmation that a click on "Přidat do
  // košíku" actually landed (see cart-context.tsx's addItem comment for
  // why this matters). Skips the very first render so a cart hydrated
  // from localStorage doesn't bump on page load.
  useEffect(() => {
    if (itemCount > previousCount.current) {
      setBumping(true);
      const timeout = setTimeout(() => setBumping(false), 400);
      previousCount.current = itemCount;
      return () => clearTimeout(timeout);
    }
    previousCount.current = itemCount;
  }, [itemCount]);

  return (
    <Link href="/kosik" className="relative flex items-center gap-1.5 text-sm font-medium">
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.8}
        className={`h-5 w-5 ${bumping ? "animate-[cart-bump_0.4s_ease-out]" : ""}`}
        aria-hidden
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M2.25 3h1.386c.51 0 .955.343 1.087.835l.383 1.437M7.5 14.25a3 3 0 0 0-3 3h15.75m-12.75-3h11.218c1.121-2.3 1.994-4.694 2.598-7.152.075-.306-.147-.598-.464-.598H5.106M7.5 14.25 5.106 5.272M9.75 20.25a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0Zm9 0a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0Z"
        />
      </svg>
      <span className="hidden sm:inline">Košík</span>
      {itemCount > 0 && (
        <span
          className={`flex h-5 min-w-5 items-center justify-center rounded-full bg-white px-1 text-xs font-semibold text-ink ${bumping ? "animate-[cart-bump_0.4s_ease-out]" : ""}`}
        >
          {itemCount}
        </span>
      )}
    </Link>
  );
}
