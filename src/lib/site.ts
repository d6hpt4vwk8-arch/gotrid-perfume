// Production domain is gotridperfume.cz (NEXT_PUBLIC_SITE_URL in Vercel env).
// Falls back to localhost for local dev/preview so feeds/sitemaps still render.
export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
