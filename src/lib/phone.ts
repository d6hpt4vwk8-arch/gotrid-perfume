/**
 * Phone numbers for carriers (Zásilkovna, GLS, Balíkovna) and Comgate.
 *
 * Customers type numbers every way imaginable ("602 603 228", "00420602603228", "0908 426 569", "+421 905 123 456")
 * and carriers are picky: Packeta wants a dialing code, GLS refuses a ContactPhone it cannot parse. We therefore
 * store one canonical form, E.164 ("+420602603228"), and let a customer keep a Slovak (or other foreign) number even
 * when the parcel goes to Česko — the number is only a contact for the carrier's SMS/PIN, not an address.
 *
 * Rules (all digits only after stripping spaces, dots, slashes, dashes and brackets):
 *  - "+" + 9–15 digits                      → kept as typed (any country)
 *  - "00" + country code + number          → "+" form
 *  - "420"/"421" + 9 digits (12 digits)     → "+" prefixed
 *  - 10 digits starting "09"                → Slovak mobile with the national zero ("0908…" → +421908…); a Czech number
 *                                              never has 10 digits or a leading 0
 *  - 9 digits                               → the destination country's code (CZ → +420, SK → +421)
 * Anything else (letters, an e-mail, too few digits) → null.
 */
export type PhoneCountry = "CZ" | "SK";

const SEPARATORS = /[\s().\/-]/g;

export function normalizePhone(raw: string | null | undefined, defaultCountry: PhoneCountry = "CZ"): string | null {
  if (!raw) return null;
  const compact = raw.trim().replace(SEPARATORS, "");
  if (!compact || !/^\+?\d+$/.test(compact)) return null;

  let digits: string;
  if (compact.startsWith("+")) {
    digits = compact.slice(1);
  } else if (compact.startsWith("00")) {
    digits = compact.slice(2);
  } else if (/^(420|421)\d{9}$/.test(compact)) {
    digits = compact;
  } else if (/^09\d{8}$/.test(compact)) {
    digits = "421" + compact.slice(1);
  } else if (/^\d{9}$/.test(compact)) {
    digits = (defaultCountry === "SK" ? "421" : "420") + compact;
  } else {
    return null;
  }

  // E.164 allows 15 digits at most; fewer than 9 is never a usable mobile/landline contact.
  if (digits.length < 9 || digits.length > 15) return null;
  // Czech and Slovak numbers are exactly 9 digits after the country code.
  if ((digits.startsWith("420") || digits.startsWith("421")) && digits.length !== 12) return null;
  return "+" + digits;
}
