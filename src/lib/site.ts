// TZ §8: final domain is gotridperfume.shop once DNS is switched over (§8.5).
// Falls back to localhost for local dev/preview so feeds/sitemaps still render.
export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
