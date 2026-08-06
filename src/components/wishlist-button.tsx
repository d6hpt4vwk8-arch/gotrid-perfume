"use client";

import { useWishlist, type WishlistItem } from "@/lib/wishlist-context";

export function WishlistButton({
  product,
  className = "",
}: {
  product: WishlistItem;
  className?: string;
}) {
  const { isWishlisted, toggle } = useWishlist();
  const active = isWishlisted(product.productId);

  return (
    <button
      type="button"
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        toggle(product);
      }}
      aria-pressed={active}
      aria-label={active ? "Odebrat z oblíbených" : "Přidat do oblíbených"}
      className={`flex items-center justify-center rounded-full transition ${className}`}
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill={active ? "currentColor" : "none"}
        stroke="currentColor"
        strokeWidth={1.8}
        className={`h-5 w-5 ${active ? "text-red-500" : "text-neutral-500"}`}
        aria-hidden
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12Z"
        />
      </svg>
    </button>
  );
}
