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
  /**
   * DIČ as assigned by the tax office, or null while none exists. NOT proof of
   * being a VAT payer: a s.r.o. that is only registered for income tax gets a
   * DIČ too (Gotrid s.r.o., 15. 10. 2026) — use `vatPayer` for anything that
   * depends on VAT status.
   */
  dic: string | null;
  /** Registered for VAT (plátce DPH). Drives the VAT wording in legal text and the cost-of-goods calculation. */
  vatPayer: boolean;
  street: string;
  city: string;
  /** Rendered on invoices and quoted in the obchodní podmínky. */
  vatNote: string;
  /**
   * "Zapsáno u <soud> pod číslem <spisová značka>" — only s.r.o.'s have this
   * (an OSVČ isn't entered in obchodní rejstřík at all, so null for one).
   * Same one-line format used by every real competitor checked (Notino,
   * ProdejParfemu) right next to IČO/DIČ — a defensive "100% original, no
   * fakes" claim reads like a shady-dropshipper tell, but a real, checkable
   * court registration is exactly the boring, factual signal a legitimate
   * shop is expected to show.
   */
  commercialRegister: string | null;
}

const SOLE_TRADER: SellerIdentity = {
  legalName: "Pavlo Hrytsan",
  ico: "19296037",
  dic: null,
  vatPayer: false,
  street: "Na Jarově 2425/4",
  city: "130 00 Praha 3-Žižkov",
  vatNote: "Není plátcem DPH",
  commercialRegister: null,
};

// Gotrid s.r.o. — registered 17. 9. 2026 (Městský soud v Praze, C 456103),
// sídlo is the registered-agent address, not the Na Jarově warehouse (that
// stays the GLS/Balíkovna/Zásilkovna pickup address regardless of entity).
// Address confirmed live against ares.gov.cz. DIČ CZ30030404 assigned by
// Finanční úřad pro hl. m. Prahu (ÚzP Praha 2) in the rozhodnutí o registraci
// of 15. 10. 2026 — registration for corporate income tax only, ex officio
// because the 15-day deadline after the register entry was missed. That does
// NOT make the company a VAT payer, so vatPayer stays false.
const COMPANY: SellerIdentity | null = {
  legalName: "Gotrid s.r.o.",
  ico: "30030404",
  dic: "CZ30030404",
  vatPayer: false,
  street: "Sokolská 1883/8",
  city: "120 00 Praha 2-Nové Město",
  vatNote: "Není plátcem DPH",
  commercialRegister: "Zapsáno u Městského soudu v Praze, oddíl C, vložka 456103",
};

// Company bank account and Stripe verification were the two gating
// conditions — both ready as of 2026-09-22, so the switch takes effect
// today. Local (Europe/Prague, CEST) midnight, not UTC, so every order
// placed today counts as the company's.
/** First day the s.r.o. is the seller. Orders before it stay with the sole trader forever. */
const COMPANY_SWITCH_DATE: Date | null = new Date("2026-09-22T00:00:00+02:00");

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

/** "Gotrid s.r.o., IČO 30030404, DIČ CZ30030404" — the one-line form used in the footer and legal text. */
export function sellerLine(seller: SellerIdentity): string {
  return `${seller.legalName}, IČO ${seller.ico}${seller.dic ? `, DIČ ${seller.dic}` : ""}`;
}

/** Internal notifications (new order, stock warnings). Moves to a company mailbox via env — no deploy needed. */
export const OWNER_EMAIL = process.env.OWNER_EMAIL ?? "pavlohrytsan@gmail.com";
