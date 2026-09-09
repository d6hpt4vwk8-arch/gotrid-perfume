// Split out of consent-context.tsx (a "use client" module) on purpose: a
// plain constant re-exported from a client module resolves to `undefined`
// when imported into a Server Component — Next's RSC bundler turns every
// export of a "use client" file into an opaque client reference, even for
// values that were never components. (shop)/layout.tsx needs the real
// string to read the cookie server-side, so it — and anything else that
// needs the name from either side of the boundary — imports it from here
// instead.
export const CONSENT_COOKIE_NAME = "gotrid-consent";

export interface ConsentState {
  analytics: boolean;
  marketing: boolean;
}
