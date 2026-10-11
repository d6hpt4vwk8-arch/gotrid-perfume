/**
 * Splits a Czech IBAN (CZkk BBBB PPPPPP NNNNNNNNNN) into the domestic
 * "prefix-number/bank code" form customers type into a banking app.
 * Returns null for non-CZ or malformed IBANs.
 */
export function czAccountFromIban(iban: string): string | null {
  const clean = iban.replace(/\s/g, "").toUpperCase();
  const m = clean.match(/^CZ\d{2}(\d{4})(\d{6})(\d{10})$/);
  if (!m) return null;
  const [, bank, prefix, number] = m;
  const prefixPart = prefix.replace(/^0+/, "");
  return `${prefixPart ? `${prefixPart}-` : ""}${number.replace(/^0+/, "")}/${bank}`;
}
