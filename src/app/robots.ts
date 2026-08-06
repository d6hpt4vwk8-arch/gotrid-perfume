import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";

// TZ §7.5: feeds must stay crawlable for Heureka/Zboží/Meta bots — only
// non-SEO functional pages (admin API, cart, checkout) are disallowed.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/api/",
        "/admin/",
        "/kosik",
        "/pokladna",
        "/hledat",
        "/oblibene",
        "/muj-ucet",
        "/prihlaseni",
        "/registrace",
        "/zapomenute-heslo",
        "/obnovit-heslo",
      ],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
