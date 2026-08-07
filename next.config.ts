import type { NextConfig } from "next";
import productRedirects from "./src/lib/redirects/product-redirects.json";

// Pragmatic baseline CSP: allows the third-party origins we actually load
// (Meta Pixel, Packeta/Zásilkovna widget + its OSM map tiles) and keeps
// 'unsafe-inline' for scripts/styles because Next.js hydrates via inline
// <script> payloads without a nonce by default — a stricter nonce-based CSP
// would need per-request wiring through middleware. Still meaningfully
// better than no CSP at all (blocks arbitrary third-party script injection).
// Next.js dev mode executes application code through eval()-wrapped modules
// (webpack's Fast Refresh runtime) — without 'unsafe-eval' the CSP silently
// breaks all client-side JS in `next dev` (hydration, event handlers) while
// looking fine in a production build, which doesn't need eval. Scoped to
// dev only so production keeps the tighter policy.
const isDev = process.env.NODE_ENV !== "production";

const CSP = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline' ${isDev ? "'unsafe-eval' " : ""}https://connect.facebook.net https://widget.packeta.com`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: https:",
  "font-src 'self' data:",
  "connect-src 'self' https://connect.facebook.net https://widget.packeta.com https://*.packeta.com https://*.tile.openstreetmap.org",
  "frame-src 'self' https://widget.packeta.com",
  "frame-ancestors 'self'",
  "base-uri 'self'",
  "form-action 'self'",
].join("; ");

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "Content-Security-Policy", value: CSP },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        ],
      },
      {
        // Order confirmation + invoice/access endpoints carry customer PII
        // and (briefly) a bearer token — don't cache, don't leak the URL via
        // Referer, don't let it get indexed (security audit finding).
        source: "/objednavka/:path*",
        headers: [
          { key: "Cache-Control", value: "private, no-store" },
          { key: "Referrer-Policy", value: "no-referrer" },
          { key: "X-Robots-Tag", value: "noindex, nofollow" },
        ],
      },
      {
        source: "/api/orders/:path*",
        headers: [
          { key: "Cache-Control", value: "private, no-store" },
          { key: "Referrer-Policy", value: "no-referrer" },
          { key: "X-Robots-Tag", value: "noindex, nofollow" },
        ],
      },
    ];
  },
  async redirects() {
    // TZ §8.1: preserve old Shoptet URLs where possible — product slugs are
    // reused as-is (see scripts/import-real-catalog.ts), so the only gap is
    // the old flat "/slug/" vs the new "/produkt/slug" path.
    return productRedirects.map((r) => ({
      source: r.source,
      destination: r.destination,
      permanent: true,
    }));
  },
};

export default nextConfig;
