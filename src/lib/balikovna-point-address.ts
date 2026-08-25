// Balíkovna's nAPI B2B v1.4.0 (the only spec version this codebase could
// retrieve) has no field for "route to výdejní místo X" — the way parcels
// actually reach a pickup point/AlzaBox is by addressing them directly to
// that point's own physical street address (confirmed against the live API:
// omitting it entirely returns responseCode 11 "INVALID_LOCATION").
// BalikovnaPoint.address is a single feed string like
// "Zahradní 216/1, 66444, Ořechov" or, for Prague, with an extra city-part
// segment: "Kodaňská 485/63, Vršovice, 10100, Praha 10" — this pulls the
// street/houseNumber/zipCode back out of it. city comes from the point's
// own `city` column instead of being re-parsed from the string.
export function parseBalikovnaPointAddress(address: string): {
  street: string;
  houseNumber?: string;
  sequenceNumber?: string;
  zipCode: string;
} {
  const segments = address.split(",").map((s) => s.trim());
  const zipCode = segments.find((s) => /^\d{5}$/.test(s)) ?? "";

  const rawStreet = segments[0] ?? "";
  const parts = rawStreet.split(/\s+/).filter(Boolean);
  const last = parts[parts.length - 1];
  // Czech street names don't end in a digit — a trailing token starting
  // with one is the house number, written as "popisné/orientační"
  // (e.g. "216/1", "699/62a") — the API wants those as two separate fields
  // (houseNumber/sequenceNumber), not one combined string.
  if (parts.length > 1 && /^\d/.test(last)) {
    const street = parts.slice(0, -1).join(" ");
    const [houseNumber, sequenceNumber] = last.split("/");
    return { street, houseNumber, sequenceNumber, zipCode };
  }
  return { street: rawStreet, zipCode };
}
