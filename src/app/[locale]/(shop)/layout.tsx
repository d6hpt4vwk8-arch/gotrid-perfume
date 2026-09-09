import { headers } from "next/headers";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { Providers } from "@/components/providers";
import { CookieBanner } from "@/components/cookie-banner";
import { MetaPixel } from "@/components/meta-pixel";
import { SklikPixel } from "@/components/sklik-pixel";
import { Clarity } from "@/components/clarity";
import { BenefitsBar } from "@/components/benefits-bar";
import { NewsletterSignup } from "@/components/newsletter-signup";
import { getSettings } from "@/lib/settings.server";
import { CONSENT_COOKIE_NAME, type ConsentState } from "@/lib/consent-cookie";

// Read server-side (a cookie, not localStorage, precisely so this is
// possible) so the very first response already reflects a returning
// visitor's choice — without this, CookieBanner had to wait for a
// post-mount effect to check storage, showing itself for one paint on
// every reload even after the visitor had already answered.
//
// Deliberately parsed out of the raw `cookie` header via headers() rather
// than next/headers' cookies().get(): this route goes through
// middleware.ts's overrideRequestHeaders(), a hand-rolled equivalent of
// NextResponse.next({request:{headers}}) needed because next-intl's
// middleware builds its own response and doesn't expose a pass-through hook
// for one. That correctly forwards the raw header bag (confirmed via
// headers().get("cookie")), but Next's cookies() jar is populated earlier
// in the request pipeline and doesn't pick up cookies added this way — so
// cookies().get() here always came back empty despite the cookie genuinely
// being present in the request.
function readConsentCookie(cookieHeader: string | null): ConsentState | null {
  if (!cookieHeader) return null;
  const match = cookieHeader.match(new RegExp(`(?:^|; )${CONSENT_COOKIE_NAME}=([^;]*)`));
  if (!match) return null;
  try {
    const parsed = JSON.parse(decodeURIComponent(match[1]!));
    if (typeof parsed?.analytics === "boolean" && typeof parsed?.marketing === "boolean") {
      return parsed;
    }
    return null;
  } catch {
    return null;
  }
}

// Google Consent Mode v2 default signals — must be queued before any Google
// tag loads (TZ §5.9), even though no GA4 property is wired up yet. Denied
// by default; ConsentProvider pushes 'update' once the visitor decides.
const CONSENT_MODE_BOOTSTRAP = `
  window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);}
  gtag('consent', 'default', {
    ad_storage: 'denied',
    ad_user_data: 'denied',
    ad_personalization: 'denied',
    analytics_storage: 'denied',
    wait_for_update: 500
  });
  window.gtag = gtag;
`;

export default async function ShopLayout({ children }: { children: React.ReactNode }) {
  const settings = await getSettings();
  const headerList = await headers();
  const nonce = headerList.get("x-nonce") ?? undefined;
  const initialConsent = readConsentCookie(headerList.get("cookie"));

  return (
    <>
      <script nonce={nonce} dangerouslySetInnerHTML={{ __html: CONSENT_MODE_BOOTSTRAP }} />
      <Providers freeShippingThreshold={settings.freeShippingThreshold} initialConsent={initialConsent}>
        <MetaPixel />
        <SklikPixel />
        <Clarity />
        <BenefitsBar />
        <SiteHeader />
        {children}
        <NewsletterSignup />
        <SiteFooter />
        <CookieBanner />
      </Providers>
    </>
  );
}
