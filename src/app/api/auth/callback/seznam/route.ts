import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { CUSTOMER_COOKIE_NAME, createCustomerSessionToken } from "@/lib/customer/session";
import { getSafeRedirectPath } from "@/lib/safe-redirect";
import { SITE_URL } from "@/lib/site";
import {
  SEZNAM_STATE_COOKIE,
  SEZNAM_NEXT_COOKIE,
  exchangeSeznamCode,
  getSeznamProfile,
} from "@/lib/customer/seznam-oauth";

function errorRedirect(message: string) {
  const url = new URL("/prihlaseni", SITE_URL);
  url.searchParams.set("error", message);
  return NextResponse.redirect(url);
}

export async function GET(req: NextRequest) {
  const clientId = process.env.SEZNAM_OAUTH_CLIENT_ID;
  const clientSecret = process.env.SEZNAM_OAUTH_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    return errorRedirect("Přihlášení přes Seznam není nakonfigurováno.");
  }

  const code = req.nextUrl.searchParams.get("code");
  const state = req.nextUrl.searchParams.get("state");
  const savedState = req.cookies.get(SEZNAM_STATE_COOKIE)?.value;
  const next = getSafeRedirectPath(req.cookies.get(SEZNAM_NEXT_COOKIE)?.value ?? null, "/muj-ucet");

  if (!code || !state || !savedState || state !== savedState) {
    return errorRedirect("Přihlášení přes Seznam se nezdařilo, zkuste to prosím znovu.");
  }

  const accessToken = await exchangeSeznamCode({
    code,
    redirectUri: `${SITE_URL}/api/auth/callback/seznam`,
    clientId,
    clientSecret,
  });
  if (!accessToken) {
    return errorRedirect("Přihlášení přes Seznam se nezdařilo, zkuste to prosím znovu.");
  }

  const profile = await getSeznamProfile(accessToken);
  if (!profile?.email) {
    return errorRedirect("Váš účet Seznam nemá nastavený e-mail — přihlaste se prosím e-mailem a heslem.");
  }

  const email = profile.email.trim().toLowerCase();
  // Same email-keyed upsert idiom as checkout/newsletter — an existing
  // password-based account with this email just gains a Seznam sign-in path,
  // it isn't overwritten (update: {} touches nothing on an existing row).
  const customer = await prisma.customer.upsert({
    where: { email },
    update: {},
    create: {
      email,
      firstName: profile.firstname ?? undefined,
      lastName: profile.lastname ?? undefined,
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
  res.cookies.delete(SEZNAM_STATE_COOKIE);
  res.cookies.delete(SEZNAM_NEXT_COOKIE);
  return res;
}
