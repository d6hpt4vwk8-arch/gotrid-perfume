"use client";

import { useCart } from "@/lib/cart-context";

export function CartToast() {
  const { toast } = useCart();

  if (!toast) return null;

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-4 z-50 flex justify-center px-4 sm:justify-end sm:right-6 sm:left-auto">
      <div className="animate-[toast-in_0.25s_ease-out] rounded-sm bg-ink px-4 py-3 text-sm font-medium text-white shadow-lg">
        {toast}
      </div>
    </div>
  );
}
