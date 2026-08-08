import type { NextConfig } from "next";
import productRedirects from "./src/lib/redirects/product-redirects.json";

// Content-Security-Policy is set per-request in src/middleware.ts instead of
// here — it needs a fresh nonce on every request (script-src has no
// 'unsafe-inline'), which a static header list can't produce.
const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
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
