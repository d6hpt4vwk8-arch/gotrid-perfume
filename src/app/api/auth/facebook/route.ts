import { NextRequest, NextResponse } from "next/server";
import { getSafeRedirectPath } from "@/lib/safe-redirect";
import { SITE_URL } from "@/lib/site";
import { FACEBOOK_STATE_COOKIE, FACEBOOK_NEXT_COOKIE } from "@/lib/customer/facebook-oauth";

// Kicks off Facebook Login — see src/lib/customer/facebook-oauth.ts and
// https://developers.facebook.com/docs/facebook-login/guides/advanced/manual-flow/
export async function GET(req: NextRequest) {
  const appId = process.env.FACEBOOK_OAUTH_APP_ID;
  if (!appId) {
    return NextResponse.json({ error: "Přihlášení přes Facebook není nakonfigurováno." }, { status: 500 });
  }

  const next = getSafeRedirectPath(req.nextUrl.searchParams.get("next"), "/muj-ucet");
  const state = crypto.randomUUID();

  const authorizeUrl = new URL("https://www.facebook.com/v25.0/dialog/oauth");
  authorizeUrl.searchParams.set("client_id", appId);
  authorizeUrl.searchParams.set("redirect_uri", `${SITE_URL}/api/auth/callback/facebook`);
  authorizeUrl.searchParams.set("state", state);
  authorizeUrl.searchParams.set("scope", "public_profile,email");

  const res = NextResponse.redirect(authorizeUrl);
  const cookieOpts = {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: 600,
  };
  res.cookies.set(FACEBOOK_STATE_COOKIE, state, cookieOpts);
  res.cookies.set(FACEBOOK_NEXT_COOKIE, next, cookieOpts);
  return res;
}
