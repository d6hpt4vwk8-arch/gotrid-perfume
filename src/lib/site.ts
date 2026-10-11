// Production domain is gotridperfume.cz (NEXT_PUBLIC_SITE_URL in Vercel env).
// Falls back to localhost for local dev/preview so feeds/sitemaps still render.
export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

/**
 * Public host used for everything search engines read — sitemap, robots,
 * canonical tags, JSON-LD. Production serves the shop on www.gotridperfume.cz
 * and 308-redirects the apex there, but NEXT_PUBLIC_SITE_URL is the apex (it is
 * also the base for OAuth callbacks, e-mail links and feeds, which must not
 * move), so the www is added here only for SEO.
 */
export const SEO_URL = SITE_URL.replace(/^(https?:\/\/)(gotridperfume\.cz)(?=\/|$)/, "$1www.$2");

export const INSTAGRAM_HANDLE = "gotrid_perfume";
export const INSTAGRAM_URL = `https://www.instagram.com/${INSTAGRAM_HANDLE}/`;
export const FACEBOOK_URL = "https://www.facebook.com/Gotrid.perfume/";
export const TIKTOK_URL = "https://www.tiktok.com/@gotrid_perfume";
