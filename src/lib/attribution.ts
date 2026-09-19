export const ATTRIBUTION_COOKIE = "gotrid-source";

// Referral hostnames worth naming explicitly — price comparators and ad
// platforms we actually advertise on (see the *-pixel.tsx / *-conversion.tsx
// components), so the admin sees "Heureka.cz" instead of a bare domain.
// Anything else falls back to its own hostname, which is still more useful
// than nothing for a channel we haven't named yet.
const KNOWN_SOURCES: Record<string, string> = {
  "heureka.cz": "Heureka.cz",
  "heureka.sk": "Heureka.sk",
  "zbozi.cz": "Zboží.cz",
  "glami.cz": "GLAMI.cz",
  "glami.sk": "GLAMI.sk",
  "google.com": "Google (organické)",
  "google.cz": "Google (organické)",
  "google.sk": "Google (organické)",
  "seznam.cz": "Seznam.cz (organické)",
  "facebook.com": "Facebook",
  "m.facebook.com": "Facebook",
  "l.facebook.com": "Facebook",
  "instagram.com": "Instagram",
  "l.instagram.com": "Instagram",
  "bing.com": "Bing",
};

function hostnameLabel(hostname: string): string {
  const bare = hostname.replace(/^www\./, "");
  return KNOWN_SOURCES[bare] ?? bare;
}

/**
 * First-touch acquisition label from the landing referrer + UTM params —
 * called once, client-side, on the visitor's first page view (see
 * AttributionTracker). An explicit utm_source always wins (it's the site
 * telling us directly why the click happened, e.g. a specific ad campaign),
 * then the referring page's own hostname, then "Přímá návštěva" for a bare
 * URL open (bookmark, typed address, or a referrer the browser stripped).
 */
export function computeAttributionLabel(referrer: string, search: string, currentHostname: string): string {
  const params = new URLSearchParams(search);
  const utmSource = params.get("utm_source");
  if (utmSource) {
    const medium = params.get("utm_medium");
    const campaign = params.get("utm_campaign");
    return [utmSource, medium, campaign].filter(Boolean).join(" / ");
  }

  if (!referrer) return "Přímá návštěva";
  try {
    const url = new URL(referrer);
    if (url.hostname === "" || url.hostname === currentHostname) return "Přímá návštěva";
    return hostnameLabel(url.hostname);
  } catch {
    return "Přímá návštěva";
  }
}
