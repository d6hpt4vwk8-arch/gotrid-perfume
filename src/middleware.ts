import { NextRequest, NextResponse } from "next/server";
import createIntlMiddleware from "next-intl/middleware";
import { routing } from "@/i18n/routing";
import { ADMIN_COOKIE_NAME, verifySessionToken } from "@/lib/admin-auth";

const PUBLIC_PATHS = new Set(["/admin/login", "/api/admin/login", "/api/admin/logout"]);

// Next.js hydrates via inline <script> payloads — without a nonce, CSP has
// to fall back to 'unsafe-inline' for script-src, which barely constrains
// anything (security audit finding M-05). Generating a per-request nonce
// here and reading it via headers()/x-nonce in layouts lets script-src drop
// 'unsafe-inline' entirely; 'strict-dynamic' covers scripts those inline
// scripts create at runtime (Meta Pixel, the Packeta widget loader), so the
// explicit https:// origins only matter as a fallback for browsers that
// don't support strict-dynamic yet.
const isDev = process.env.NODE_ENV !== "production";

function buildCsp(nonce: string): string {
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic' ${isDev ? "'unsafe-eval' " : ""}https://connect.facebook.net https://widget.packeta.com https://c.seznam.cz https://www.clarity.ms`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: https:",
    "font-src 'self' data:",
    "connect-src 'self' https://connect.facebook.net https://widget.packeta.com https://*.packeta.com https://*.tile.openstreetmap.org https://c.seznam.cz https://h.seznam.cz https://*.clarity.ms",
    "frame-src 'self' https://widget.packeta.com",
    "frame-ancestors 'self'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join("; ");
}

const intlMiddleware = createIntlMiddleware(routing);

// next-intl's middleware builds its own NextResponse internally (rewrite
// for the default locale, redirect for prefixed locales), so the usual
// `NextResponse.next({ request: { headers } })` shortcut can't be used to
// forward our nonce header through it. This reapplies the same
// request-header-override mechanism Next.js itself uses for that shortcut
// (see node_modules/next/dist/server/web/spec-extension/response.js,
// handleMiddlewareField) directly to whatever response next-intl returns.
function overrideRequestHeaders(response: NextResponse, headers: Headers): NextResponse {
  const keys: string[] = [];
  headers.forEach((value, key) => {
    response.headers.set(`x-middleware-request-${key}`, value);
    keys.push(key);
  });
  response.headers.set("x-middleware-override-headers", keys.join(","));
  return response;
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  const nonce = crypto.randomUUID();
  const csp = buildCsp(nonce);

  const requestHeaders = new Headers(req.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", csp);

  const isAdminPath = pathname.startsWith("/admin") || pathname.startsWith("/api/admin");
  if (isAdminPath && !PUBLIC_PATHS.has(pathname)) {
    const isAuthed = await verifySessionToken(req.cookies.get(ADMIN_COOKIE_NAME)?.value);
    if (!isAuthed) {
      if (pathname.startsWith("/api/admin")) {
        const res = NextResponse.json({ error: "Neautorizováno." }, { status: 401 });
        res.headers.set("Content-Security-Policy", csp);
        return res;
      }
      const loginUrl = new URL("/admin/login", req.url);
      loginUrl.searchParams.set("next", pathname);
      const res = NextResponse.redirect(loginUrl);
      res.headers.set("Content-Security-Policy", csp);
      return res;
    }
  }

  // Only the storefront (routed under src/app/[locale]/(shop)) is
  // locale-aware — /admin, /api, /feeds, root-level routes like
  // sitemap.xml/robots.txt, and every static file under /public (favicon,
  // logo, and critically /uploads/products/** — ALL product images) live
  // outside [locale] and must never be rewritten/redirected by next-intl.
  // Static files are excluded generally (anything with a file extension in
  // its last path segment) rather than by an exact-path list: a hardcoded
  // list silently stops covering new assets (this is exactly how
  // /uploads/** — i.e. every product photo on the site — went unnoticed
  // and 404'd site-wide for hours after the [locale] migration, since
  // /uploads wasn't on the original list).
  const hasFileExtension = /\.[a-zA-Z0-9]+$/.test(pathname);
  const isLocaleAware =
    !pathname.startsWith("/admin") &&
    !pathname.startsWith("/api") &&
    !pathname.startsWith("/feeds") &&
    !hasFileExtension;

  if (isLocaleAware) {
    const response = intlMiddleware(req);
    overrideRequestHeaders(response, requestHeaders);
    response.headers.set("Content-Security-Policy", csp);
    return response;
  }

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set("Content-Security-Policy", csp);
  return response;
}

export const config = {
  matcher: [
    // Everything except Next's own static/image assets — those are served
    // straight from disk/CDN, not through a page render that could use nonce.
    "/((?!_next/static|_next/image|favicon.ico|icon.svg).*)",
  ],
};
