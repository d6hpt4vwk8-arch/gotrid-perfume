import Image from "next/image";
import type { ShippingMethod } from "@prisma/client";

// Real carrier logos (public/shipping-logos/*), sourced from each carrier's
// own site/press assets 2026-09-04 — not a hand-drawn approximation.
// OSOBNI_ODBER has no external brand, so it keeps a simple pin icon.
const LOGO_SRC: Partial<Record<ShippingMethod, string>> = {
  ZASILKOVNA: "/shipping-logos/zasilkovna.svg",
  PPL: "/shipping-logos/ppl.svg",
  DPD: "/shipping-logos/dpd.svg",
  BALIKOVNA: "/shipping-logos/balikovna.svg",
  GLS: "/shipping-logos/gls.svg",
};

export function ShippingIcon({ method, className }: { method: ShippingMethod; className?: string }) {
  const src = LOGO_SRC[method];
  if (!src) {
    return (
      <svg width="26" height="22" viewBox="0 0 26 22" role="img" aria-label="Osobní odběr" className={className}>
        <rect width="26" height="22" rx="3" fill="#F0F0EC" />
        <path
          d="M13 5c-2.5 0-4.5 2-4.5 4.5 0 3.4 4.5 7.5 4.5 7.5s4.5-4.1 4.5-7.5C17.5 7 15.5 5 13 5Z"
          fill="none"
          stroke="#3A3A34"
          strokeWidth="1.4"
        />
        <circle cx="13" cy="9.5" r="1.6" fill="#3A3A34" />
      </svg>
    );
  }
  return (
    <span className={`inline-flex h-[22px] w-[34px] items-center justify-center ${className ?? ""}`}>
      <Image src={src} alt="" width={34} height={22} unoptimized className="max-h-[22px] w-auto object-contain" />
    </span>
  );
}
