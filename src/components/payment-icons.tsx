import Image from "next/image";

// Payment marks shown near the checkout submit button, on product pages, in the cart and in the footer so customers
// recognize the accepted methods before they reach the gateway. Cards plus the Apple Pay / Google Pay wallets
// (Comgate shows both automatically on its card page when the device supports them; Stripe does the same).
const APPLE_LOGO =
  "M12.152 6.896c-.948 0-2.415-1.078-3.96-1.04-2.04.027-3.91 1.183-4.961 3.014-2.117 3.675-.546 9.103 1.519 12.09 1.013 1.454 2.208 3.09 3.792 3.039 1.52-.065 2.09-.987 3.935-.987 1.831 0 2.35.987 3.96.948 1.637-.026 2.676-1.48 3.676-2.948 1.156-1.688 1.636-3.325 1.662-3.415-.039-.013-3.182-1.221-3.22-4.857-.026-3.04 2.48-4.494 2.597-4.559-1.429-2.09-3.623-2.324-4.39-2.376-2-.156-3.675 1.09-4.61 1.09zM15.53 3.83c.843-1.012 1.4-2.427 1.245-3.83-1.207.052-2.662.805-3.532 1.818-.78.896-1.454 2.338-1.273 3.714 1.338.104 2.715-.688 3.559-1.701";

export function ApplePayMark() {
  return (
    <svg width="38" height="24" viewBox="0 0 38 24" role="img" aria-label="Apple Pay">
      <rect width="38" height="24" rx="3" fill="#000" />
      <g transform="translate(7.5 6.2) scale(0.4)">
        <path d={APPLE_LOGO} fill="#fff" />
      </g>
      <text x="16.5" y="16" fontFamily="Arial, sans-serif" fontWeight="600" fontSize="9.5" fill="#fff">
        Pay
      </text>
    </svg>
  );
}

// Official Google Pay mark (Wikimedia Commons "Google Pay Logo"), sized so the whole "G Pay" fits the 38×24 tile.
export function GooglePayMark() {
  return (
    <span
      role="img"
      aria-label="Google Pay"
      className="flex h-6 w-[38px] items-center justify-center rounded-[3px] border border-[#e2e2e2] bg-white"
    >
      <Image src="/payments/google-pay.svg" alt="" width={64} height={24} unoptimized className="h-[13px] w-auto" />
    </span>
  );
}

export function PaymentIcons() {
  return (
    <div className="flex flex-wrap items-center gap-2" aria-label="Přijímáme platby: Visa, Mastercard, Apple Pay, Google Pay">
      <svg width="38" height="24" viewBox="0 0 38 24" role="img" aria-label="Visa">
        <rect width="38" height="24" rx="3" fill="#1A1F71" />
        <text
          x="19"
          y="16.5"
          textAnchor="middle"
          fontFamily="Arial, sans-serif"
          fontStyle="italic"
          fontWeight="700"
          fontSize="11"
          fill="#fff"
        >
          VISA
        </text>
      </svg>
      <svg width="38" height="24" viewBox="0 0 38 24" role="img" aria-label="Mastercard">
        <rect width="38" height="24" rx="3" fill="#fff" stroke="#e2e2e2" />
        <circle cx="16" cy="12" r="7" fill="#EB001B" />
        <circle cx="24" cy="12" r="7" fill="#F79E1B" fillOpacity="0.9" />
      </svg>
      <ApplePayMark />
      <GooglePayMark />
    </div>
  );
}
