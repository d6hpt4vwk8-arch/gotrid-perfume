// Split out of currency-context.tsx (a "use client" module) for the same
// reason as consent-cookie.ts: a plain export from a "use client" file
// resolves to `undefined` when imported into a Server Component. Several
// server components (layout, product pages, benefits bar) each read this
// cookie directly via headers() rather than prop-drilling it down, so the
// name and parser live here where both sides of the boundary can reach them.
export const CURRENCY_COOKIE_NAME = "gotrid-currency";

export type Currency = "CZK" | "EUR";

/**
 * Parsed out of the raw `cookie` header, not next/headers' cookies() — in
 * this app's (shop) layout, cookies() reliably comes back empty because of
 * how middleware.ts forwards request headers for next-intl (see that
 * layout's readConsentCookie for the full explanation). Any server
 * component reading this cookie should do the same: await headers(), then
 * pass headerList.get("cookie") in here.
 */
export function readCurrencyCookie(cookieHeader: string | null): Currency {
  if (!cookieHeader) return "CZK";
  const match = cookieHeader.match(new RegExp(`(?:^|; )${CURRENCY_COOKIE_NAME}=([^;]*)`));
  return match?.[1] === "EUR" ? "EUR" : "CZK";
}
