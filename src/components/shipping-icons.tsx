import type { ShippingMethod } from "@prisma/client";

// Small carrier wordmarks shown next to each shipping option — same idea and
// style as PaymentIcons (hand-drawn inline SVG "badge" per brand, not a
// traced/embedded logo file), so customers recognize the carrier at a
// glance without needing real logo assets checked into the repo.
export function ShippingIcon({ method, className }: { method: ShippingMethod; className?: string }) {
  const common = { width: 34, height: 22, className };

  switch (method) {
    case "ZASILKOVNA":
      return (
        <svg {...common} viewBox="0 0 34 22" role="img" aria-label="Zásilkovna">
          <rect width="34" height="22" rx="3" fill="#5A1F8C" />
          <text
            x="17"
            y="14.5"
            textAnchor="middle"
            fontFamily="Arial, sans-serif"
            fontWeight="700"
            fontSize="8"
            fill="#fff"
          >
            Z
          </text>
          <circle cx="26" cy="7" r="2.4" fill="#F6A800" />
        </svg>
      );
    case "PPL":
      return (
        <svg {...common} viewBox="0 0 34 22" role="img" aria-label="PPL">
          <rect width="34" height="22" rx="3" fill="#FF6900" />
          <text
            x="17"
            y="14.5"
            textAnchor="middle"
            fontFamily="Arial, sans-serif"
            fontWeight="700"
            fontSize="9.5"
            fill="#fff"
          >
            PPL
          </text>
        </svg>
      );
    case "DPD":
      return (
        <svg {...common} viewBox="0 0 34 22" role="img" aria-label="DPD">
          <rect width="34" height="22" rx="3" fill="#DC0032" />
          <text
            x="17"
            y="14"
            textAnchor="middle"
            fontFamily="Arial, sans-serif"
            fontWeight="700"
            fontSize="9.5"
            fill="#fff"
          >
            DPD
          </text>
          <rect x="0" y="18" width="34" height="4" fill="#F4C300" />
        </svg>
      );
    case "BALIKOVNA":
      return (
        <svg {...common} viewBox="0 0 34 22" role="img" aria-label="Balíkovna">
          <rect width="34" height="22" rx="3" fill="#EE7203" />
          <text
            x="17"
            y="14.5"
            textAnchor="middle"
            fontFamily="Arial, sans-serif"
            fontWeight="700"
            fontSize="7"
            fill="#fff"
          >
            Balíkovna
          </text>
        </svg>
      );
    case "GLS":
      return (
        <svg {...common} viewBox="0 0 34 22" role="img" aria-label="GLS">
          <rect width="34" height="22" rx="3" fill="#fff" stroke="#e2e2e2" />
          <text
            x="15"
            y="15.5"
            textAnchor="middle"
            fontFamily="Arial, sans-serif"
            fontWeight="800"
            fontStyle="italic"
            fontSize="11"
            fill="#003057"
          >
            gls
          </text>
          <circle cx="28" cy="16" r="2.2" fill="#F5A800" />
        </svg>
      );
    case "OSOBNI_ODBER":
      return (
        <svg {...common} viewBox="0 0 34 22" role="img" aria-label="Osobní odběr">
          <rect width="34" height="22" rx="3" fill="#F0F0EC" />
          <path
            d="M17 5c-2.5 0-4.5 2-4.5 4.5 0 3.4 4.5 7.5 4.5 7.5s4.5-4.1 4.5-7.5C21.5 7 19.5 5 17 5Z"
            fill="none"
            stroke="#3A3A34"
            strokeWidth="1.4"
          />
          <circle cx="17" cy="9.5" r="1.6" fill="#3A3A34" />
        </svg>
      );
  }
}
