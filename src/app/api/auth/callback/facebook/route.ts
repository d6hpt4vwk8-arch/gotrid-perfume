import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { CUSTOMER_COOKIE_NAME, createCustomerSessionToken } from "@/lib/customer/session";
import { getSafeRedirectPath } from "@/lib/safe-redirect";
import { SITE_URL } from "@/lib/site";
import {
  FACEBOOK_STATE_COOKIE,
  FACEBOOK_NEXT_COOKIE,
  exchangeFacebookCode,
  getFacebookProfile,
} from "@/lib/customer/facebook-oauth";

function errorRedirect(message: string) {
  const url = new URL("/prihlaseni", SITE_URL);
  url.searchParams.set("error", message);
  return NextResponse.redirect(url);
}

export async function GET(req: NextRequest) {
  const appId = process.env.FACEBOOK_OAUTH_APP_ID;
  const appSecret = process.env.FACEBOOK_OAUTH_APP_SECRET;
  if (!appId || !appSecret) {
    return errorRedirect("Přihlášení přes Facebook není nakonfigurováno.");
  }

  // Facebook redirects here with error=access_denied (no code) if the
  // visitor cancels the dialog — treat that as a quiet return to login,
  // not an error worth alarming them with.
  if (req.nextUrl.searchParams.get("error")) {
    return NextResponse.redirect(new URL("/prihlaseni", SITE_URL));
  }

  const code = req.nextUrl.searchParams.get("code");
  const state = req.nextUrl.searchParams.get("state");
  const savedState = req.cookies.get(FACEBOOK_STATE_COOKIE)?.value;
  const next = getSafeRedirectPath(req.cookies.get(FACEBOOK_NEXT_COOKIE)?.value ?? null, "/muj-ucet");

  if (!code || !state || !savedState || state !== savedState) {
    return errorRedirect("Přihlášení přes Facebook se nezdařilo, zkuste to prosím znovu.");
  }

  const accessToken = await exchangeFacebookCode({
    code,
    redirectUri: `${SITE_URL}/api/auth/callback/facebook`,
    appId,
    appSecret,
  });
  if (!accessToken) {
    return errorRedirect("Přihlášení přes Facebook se nezdařilo, zkuste to prosím znovu.");
  }

  const profile = await getFacebookProfile(accessToken);
  if (!profile?.email) {
    return errorRedirect(
      "Váš účet Facebook nemá potvrzený e-mail nebo jste přístup k e-mailu neschválili — přihlaste se prosím e-mailem a heslem.",
    );
  }

  const email = profile.email.trim().toLowerCase();
  const customer = await prisma.customer.upsert({
    where: { email },
    update: {},
    create: {
      email,
      firstName: profile.firstName ?? undefined,
      lastName: profile.lastName ?? undefined,
    },
  });

  const res = NextResponse.redirect(new URL(next, SITE_URL));
  res.cookies.set(
    CUSTOMER_COOKIE_NAME,
    await createCustomerSessionToken(customer.id, customer.sessionVersion),
    {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 30,
    },
  );
  res.cookies.delete(FACEBOOK_STATE_COOKIE);
  res.cookies.delete(FACEBOOK_NEXT_COOKIE);
  return res;
}
