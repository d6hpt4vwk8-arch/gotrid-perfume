import { NextRequest, NextResponse } from "next/server";
import { getSafeRedirectPath } from "@/lib/safe-redirect";
import { SITE_URL } from "@/lib/site";
import { SEZNAM_STATE_COOKIE, SEZNAM_NEXT_COOKIE } from "@/lib/customer/seznam-oauth";

// Kicks off "Přihlásit se přes Seznam" — see src/lib/customer/seznam-oauth.ts
// and https://vyvojari.seznam.cz/oauth/doc for the flow this implements.
export async function GET(req: NextRequest) {
  const clientId = process.env.SEZNAM_OAUTH_CLIENT_ID;
  if (!clientId) {
    return NextResponse.json({ error: "Přihlášení přes Seznam není nakonfigurováno." }, { status: 500 });
  }

  const next = getSafeRedirectPath(req.nextUrl.searchParams.get("next"), "/muj-ucet");
  const state = crypto.randomUUID();

  const authorizeUrl = new URL("https://login.seznam.cz/api/v1/oauth/auth");
  authorizeUrl.searchParams.set("client_id", clientId);
  authorizeUrl.searchParams.set("response_type", "code");
  authorizeUrl.searchParams.set("redirect_uri", `${SITE_URL}/api/auth/callback/seznam`);
  // "identity" is the mandatory scope and is the only one that carries
  // email/firstname/lastname — see /oauth/scopes.
  authorizeUrl.searchParams.set("scope", "identity");
  authorizeUrl.searchParams.set("state", state);

  const res = NextResponse.redirect(authorizeUrl);
  const cookieOpts = {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: 600,
  };
  res.cookies.set(SEZNAM_STATE_COOKIE, state, cookieOpts);
  res.cookies.set(SEZNAM_NEXT_COOKIE, next, cookieOpts);
  return res;
}
