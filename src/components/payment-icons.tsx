// Card-network marks shown near the checkout submit button so customers
// recognize accepted payment methods before entering card details on
// Stripe's own page. Stripe Checkout accepts Visa/Mastercard by default and
// surfaces Google Pay automatically as a wallet option on supported devices.
export function PaymentIcons() {
  return (
    <div className="flex items-center gap-2" aria-label="Přijímáme platby: Visa, Mastercard, Google Pay">
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
      <svg width="38" height="24" viewBox="0 0 38 24" role="img" aria-label="Google Pay">
        <rect width="38" height="24" rx="3" fill="#fff" stroke="#e2e2e2" />
        <text
          x="19"
          y="16"
          textAnchor="middle"
          fontFamily="Arial, sans-serif"
          fontWeight="500"
          fontSize="8.5"
          fill="#3c4043"
        >
          <tspan fill="#4285F4">G</tspan>
          <tspan fill="#EA4335">o</tspan>
          <tspan fill="#FBBC04">o</tspan>
          <tspan fill="#4285F4">g</tspan>
          <tspan fill="#34A853">l</tspan>
          <tspan fill="#EA4335">e</tspan>
          <tspan fill="#3c4043"> Pay</tspan>
        </text>
      </svg>
    </div>
  );
}
