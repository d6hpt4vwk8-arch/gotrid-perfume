// Who is selling. Kept in one place because the shop is mid-way through a
// change of legal entity — the sole trader (OSVČ) is being replaced by an
// s.r.o. — and that identity is quoted in ~10 places: the footer, Kontakty,
// obchodní podmínky, GDPR, the returns policy, and both generated PDFs.
//
// The switch is deliberately date-based rather than a find-and-replace:
// faktury are rendered on demand from the order row, so swapping the seller
// outright would silently reissue every past invoice under a company that
// didn't exist when the sale happened. An invoice must always name the
// entity that actually made that contract.

export interface SellerIdentity {
  /** Legal name exactly as registered — must match ARES, the domain registrant and the payment account. */
  legalName: string;
  ico: string;
  /** Registered VAT id, or null while not a VAT payer. */
  dic: string | null;
  street: string;
  city: string;
  /** Rendered on invoices and quoted in the obchodní podmínky. */
  vatNote: string;
}

const SOLE_TRADER: SellerIdentity = {
  legalName: "Pavlo Hrytsan",
  ico: "19296037",
  dic: null,
  street: "Na Jarově 2425/4",
  city: "130 00 Praha 3-Žižkov",
  vatNote: "Není plátcem DPH",
};

// Gotrid s.r.o. — registered 17. 9. 2026 (Městský soud v Praze, C 456103),
// sídlo is the registered-agent address, not the Na Jarově warehouse (that
// stays the GLS/Balíkovna/Zásilkovna pickup address regardless of entity).
// Not yet confirmed in ARES as of 18. 9. 2026 — re-check ares.gov.cz before
// relying on this for anything ARES-facing. DIČ left null (not yet a VAT
// payer) pending confirmation. Set COMPANY_SWITCH_DATE once the company's
// own bank account and Stripe payout entity are actually ready — filling
// this in does nothing on its own; nothing renders under the s.r.o. until
// that date is also set.
const COMPANY: SellerIdentity | null = {
  legalName: "Gotrid s.r.o.",
  ico: "30030404",
  dic: null,
  street: "Sokolská 1883/8",
  city: "120 00 Praha 2-Nové Město",
  vatNote: "Není plátcem DPH",
};

/** First day the s.r.o. is the seller. Orders before it stay with the sole trader forever. */
const COMPANY_SWITCH_DATE: Date | null = null;

/** Contact details are the shop's, not the legal entity's — unaffected by the switch. */
export const CONTACT = {
  email: "info@gotridperfume.cz",
  phone: "+420 735 583 527",
  website: "https://www.gotridperfume.cz/",
  supportHours: "Po–Pá 9:00–18:00",
} as const;

/** The entity that made the contract on `date` — use this for invoices and any per-order document. */
export function sellerForDate(date: Date): SellerIdentity {
  if (COMPANY && COMPANY_SWITCH_DATE && date >= COMPANY_SWITCH_DATE) return COMPANY;
  return SOLE_TRADER;
}

/** The entity selling right now — use this for the footer, Kontakty and the legal pages. */
export function currentSeller(): SellerIdentity {
  return sellerForDate(new Date());
}

/** "Pavlo Hrytsan, IČO 19296037" — the one-line form used in the footer and legal text. */
export function sellerLine(seller: SellerIdentity): string {
  return `${seller.legalName}, IČO ${seller.ico}`;
}

/** Internal notifications (new order, stock warnings). Moves to a company mailbox via env — no deploy needed. */
export const OWNER_EMAIL = process.env.OWNER_EMAIL ?? "pavlohrytsan@gmail.com";
